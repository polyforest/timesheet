import * as utils from "./timesheetServiceUtils.js"
import * as modal from "./modal.js"

let appProperties = {};

/**
 * Safari in OSX doesn't support date or inputs
 * @type {RegExp}
 */
const DATE_REGEX = /([\d]{4})[-/.]([\d]{1,2})[-/.]([\d]{1,2})/

/**
 * Safari in OSX doesn't support date or inputs
 * @type {RegExp}
 */
const TIME_REGEX = /([\d]{1,2}):([\d]{2})(:[\d]{2})?([\s]*(?:AM|PM))?/i

// Safari in OSX doesn't support date or inputs
const DATE_FALLBACK = `placeholder="yyyy-mm-dd" pattern="${DATE_REGEX.source}" title="Date should be in the format: yyyy-mm-dd"`;

// Safari in OSX doesn't support date or inputs
const TIME_FALLBACK = `placeholder="h:mm:ss" pattern="${TIME_REGEX.source}" title="Time should be in the format: h:mm:ss"`;

const timer = {

	/**
	 * The timestamp the timer began.
	 * @type {Date|null}
	 */
	startTime: null,

	/**
	 * The update interval handle for the timer display.
	 * @type {number}
	 */
	updateIntervalId: -1
}

/**
 * Creates a timesheet row.
 * This row should then be added to the spreadsheet table's body.
 *
 * @param row {Array<string | null>}
 * @return {HTMLTableRowElement}
 */
function createTimeRow(row) {
	const tr = document.createElement("tr");

	const startTimeTd = document.createElement("td");
	startTimeTd.innerHTML = row[0] || "";
	tr.appendChild(startTimeTd);

	const endTimeTd = document.createElement("td");
	endTimeTd.innerHTML = row[1] || "";
	tr.appendChild(endTimeTd);

	const hoursTd = document.createElement("td");
	hoursTd.innerHTML = row[2] || "";
	tr.appendChild(hoursTd);

	const categoryTd = document.createElement("td");
	categoryTd.innerHTML = row[3] || "";
	tr.appendChild(categoryTd);

	const commentsTd = document.createElement("td");
	commentsTd.innerHTML = row[4] || "";
	tr.appendChild(commentsTd);

	tr.onclick = () => {
		const index = Array.prototype.indexOf.call(tr.parentNode.children, tr);
		openSubmitForm(ele("spreadsheetId").value, index, new Date(parseDateTime(startTimeTd.innerText)), new Date(parseDateTime(endTimeTd.innerText)), categoryTd.innerText, commentsTd.innerText);
	}

	return tr;
}

function pad(num, size) {
	let s = num + "";
	while (s.length < size) s = "0" + s;
	return s;
}

/**
 * Updates the timer data.
 * @param startTime {Date|null} The timestamp the timer began.
 */
function updateTimerUi(startTime) {
	const startTimerBtn = ele("startTimerBtn");
	const stopTimerBtn = ele("stopTimerBtn");
	const timerDisplay = ele("timerDisplay");

	timer.startTime = startTime;
	if (startTime == null) {
		startTimerBtn.style.display = "";
		stopTimerBtn.style.display = "none";
		timerDisplay.innerText = "";
		stopWindowInterval();
	} else {
		startTimerBtn.style.display = "none";
		stopTimerBtn.style.display = "";

		if (timer.updateIntervalId === -1) {
			timer.updateIntervalId = window.setInterval(() => {
				refreshTime();
			}, 1000);
		}
		refreshTime();
	}
}

function refreshTime() {
	const timerDisplay = ele("timerDisplay");
	if (timerDisplay == null || timer.startTime == null) {
		stopWindowInterval();
		return;
	}
	const elapsedS = Math.floor((Date.now() - timer.startTime) / 1000);
	const h = Math.floor(elapsedS / 3600);
	const m = Math.floor((elapsedS % 3600) / 60);
	const s = Math.floor(elapsedS % 60);
	timerDisplay.innerText = pad(h, 2) + ":" + pad(m, 2) + ":" + pad(s, 2);
}

function stopWindowInterval() {
	window.clearInterval(timer.updateIntervalId);
	timer.updateIntervalId = -1;
}

/**
 * Refreshes the timesheet table data.
 * @param spreadsheetId String
 * @return {Promise<void>}
 */
async function refreshTimesheet(spreadsheetId) {
	const propertiesPromise = utils.getFileMetadata(spreadsheetId).then((response) => {
		console.debug("fileMetadata", response);
		const properties = response.result.appProperties || {}
		const startTime = properties.startTime || null;
		updateTimerUi(startTime && new Date(Number(startTime)));

		appProperties = properties;

		ele("title").innerText = response.result.name;
		ele("documentLink").href = response.result.webViewLink;
	});

	const valuesResponse = await gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId: spreadsheetId,
		range: "A2:E"
	});
	console.debug("spreadsheets.values response", valuesResponse);

	const rows = valuesResponse.result.values;
	updateTimesheetRowsUi(rows);
	await propertiesPromise;
}

function updateTimesheetRowsUi(rows) {
	const tableBody = query("#timesheetTable > tbody");
	tableBody.innerHTML = ""

	const categoriesList = /** @type {HTMLDataListElement} */ (ele("categoriesList"));

	const existingOptions = {};
	for (let i = 0; i < categoriesList.options.length; i++) {
		const option = categoriesList.options[i];
		existingOptions[option.value.toLowerCase()] = true;
	}

	if (rows !== undefined) {
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const tr = createTimeRow(row);
			tableBody.appendChild(tr);

			// Update unique categories
			const category = row[3];
			if (!!category) {
				const key = category.toLowerCase();
				if (!existingOptions.hasOwnProperty(key)) {
					existingOptions[key] = true;
					const newOption = /** @type HTMLOptionElement */ document.createElement("option");
					newOption.value = category;
					categoriesList.appendChild(newOption);
				}
			}
		}
	}
}

async function startTimerClickedHandler(spreadsheetId) {
	const startTime = new Date();
	updateTimerUi(startTime);
	await utils.updateStartTime(spreadsheetId, startTime);
}

/**
 * Coerces local time into UTC time.
 * Google Sheets time format has no time zone, so we treat time numbers as UTC.
 * However, in order to keep the Google sheet easy to manually edit, time stamps should be represented
 * as local time.
 * This method will take the start and end times, changing their timezones to UTC without converting the
 * time. In order to maintain duration integrity, if there was a local time change (DST <--> ST), offset the end time.
 *
 * @param startTime {Date}
 * @param endTime {Date}
 * @return {Array<Date>} Returns [startTimeUtc, endTimeUtc]
 */
function coerceTimesToUtc(startTime, endTime) {
	const tZOffset = (endTime.getTimezoneOffset() - startTime.getTimezoneOffset()) * 60 * 1000;
	const startTime2 = new Date(Date.UTC(startTime.getFullYear(), startTime.getMonth(), startTime.getDate(), startTime.getHours(), startTime.getMinutes(), startTime.getSeconds()))
	const endTime2 = new Date(Date.UTC(endTime.getFullYear(), endTime.getMonth(), endTime.getDate(), endTime.getHours(), endTime.getMinutes(), endTime.getSeconds()) + tZOffset)
	return [startTime2, endTime2];
}

async function stopTimerClickedHandler(spreadsheetId) {
	const times = coerceTimesToUtc(timer.startTime, new Date());
	openSubmitForm(spreadsheetId, -1, times[0], times[1], "", "");
	updateTimerUi(null);
	await utils.updateStartTime(spreadsheetId, null);
}

/**
 * Formats a UTC date as yyyy-mm-dd, according to https://xkcd.com/1179/
 *
 * @param date {Date}
 * @return {string}
 */
function formatUtcDate(date) {
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`
}

/**
 * Formats a UTC time as hh:mm:ss (24 hour format)
 *
 * @param time {Date}
 * @return {string}
 */
function formatUtcTime(time) {
	return `${pad(time.getUTCHours(), 2)}:${pad(time.getUTCMinutes(), 2)}:${pad(time.getUTCSeconds(), 2)}`;
}

/**
 * Formats a UTC datetime as yyyy-mm-dd hh:mm:ss (24 hour format)
 *
 * @param date {Date}
 * @return {string}
 */
function formatUtcDateTime(date) {
	return `${formatUtcDate(date)} ${formatUtcTime(date)}`
}

/**
 *
 * @param spreadsheetId {String}
 * @param rowId {number}
 * @param startTime {Date}
 * @param endTime {Date}
 * @param category {String}
 * @param comment {String}
 */
function openSubmitForm(spreadsheetId, rowId, startTime, endTime, category, comment) {
	const isNewEntry = (rowId === -1);
	ele("submitTimeEntryTitle").innerText = (isNewEntry) ? "New Time Entry" : "Edit Time Entry"
	ele("spreadsheetId").value = spreadsheetId;
	ele("rowId").value = rowId;
	if (isNewEntry) {
		ele("deleteEntryLink").style.display = "none";
	} else {
		ele("deleteEntryLink").style.removeProperty("display");
	}
	ele("dateStart").value = formatUtcDate(startTime);
	ele("timeStart").value = formatUtcTime(startTime);
	ele("dateEnd").value = formatUtcDate(endTime);
	ele("timeEnd").value = formatUtcTime(endTime);
	ele("category").value = category || "";
	ele("comment").value = comment || "";
	ele("timeResolutionsInput").value = !!appProperties.timeResolution ? appProperties.timeResolution.toString() : "4";

	modal.openModal(ele("submitTimeEntryContainer"));
	updateDuration();
}

/**
 * Returns the value of a date input.
 * @param id String the ID of the HTMLInputElement to parse.
 * @return number | null
 */
function dateInput(id) {
	const input = /** @type {HTMLInputElement} */ ele(id);
	if (supportsNumber(input)) return input.valueAsNumber;
	return parseDate(input.value);
}

function parseDate(str) {
	const groups = DATE_REGEX.exec(str);
	if (groups == null) return null;
	return (new Date(Date.UTC(parseInt(groups[1]), parseInt(groups[2]) - 1, parseInt(groups[3])))).getTime();
}

/**
 * Returns the value of a time  input.
 * @param id String the ID of the HTMLInputElement to parse.
 * @return number | null
 */
function timeInput(id) {
	const input = /** @type {HTMLInputElement} */ ele(id);
	if (supportsNumber(input)) return input.valueAsNumber;
	return parseTime(input.value);
}

function parseTime(str) {
	const groups = TIME_REGEX.exec(str);
	if (groups == null) return null;
	const isPm = groups[4] !== undefined && groups[4].toLowerCase() === "pm"
	const hours = parseInt(groups[1]) + ((isPm) ? 12 : 0);
	const minutes = parseInt(groups[2]);
	const seconds = parseInt(groups[3].substr(1) || 0);
	return hours * 3600000 + minutes * 60000 + seconds * 1000;
}

function parseDateTime(str) {
	const splitIndex = str.indexOf(" ");
	const dateStr = str.substring(0, splitIndex);
	const timeStr = str.substring(splitIndex + 1);
	return parseDate(dateStr) + parseTime(timeStr);
}

/**
 * @param input {HTMLInputElement}
 * @return Boolean Returns true if the input supports `valueAsNumber`
 */
function supportsNumber(input) {
	const n = input.valueAsNumber;
	return n != null && !isNaN(n);
}

async function submitTimeEntryFormHandler() {
	const rowId = parseInt(ele("rowId").value);
	const startTime = new Date(dateInput("dateStart") + timeInput("timeStart"));
	const endTime = new Date(dateInput("dateEnd") + timeInput("timeEnd"));
	const spreadsheetId = ele("spreadsheetId").value;
	const cat = ele("category").value;
	const comment = ele("comment").value;
	modal.closeModal(ele("submitTimeEntryContainer"));

	const tableBody = query("#timesheetTable > tbody");
	if (rowId === -1) {
		tableBody.appendChild(createTimeRow([formatUtcDateTime(startTime), formatUtcDateTime(endTime), ele("duration").innerText, cat, comment]));
		await utils.appendTimeEntry(spreadsheetId, startTime, endTime, cat, comment, appProperties.timeResolution || 4);
	} else {
		const previousRow = tableBody.childNodes[rowId];
		tableBody.insertBefore(createTimeRow([formatUtcDateTime(startTime), formatUtcDateTime(endTime), ele("duration").innerText, cat, comment]), previousRow);
		tableBody.removeChild(previousRow);
		await utils.updateTimeEntry(spreadsheetId, rowId, startTime, endTime, cat, comment, appProperties.timeResolution || 4);
	}
}

/**
 * Deletes the given time entry row.
 * @param spreadsheetId string
 * @param rowId number (zero-indexed)
 * @return {Promise<void>}
 */
async function deleteRow(spreadsheetId, rowId) {
	console.log("Deleting row " + rowId);
	const tableBody = query("#timesheetTable > tbody");
	tableBody.removeChild(tableBody.childNodes[rowId]);
	await utils.deleteRow(spreadsheetId, rowId);
}

/**
 * Sets the duration display to be the time difference rounded to the next time resolution value.
 */
function updateDuration() {
	const deltaS = (dateInput("dateEnd") + timeInput("timeEnd") - (dateInput("dateStart") + timeInput("timeStart"))) / 1000;
	const round = 3600 / parseInt(ele("timeResolutionsInput").value);
	const duration = Math.ceil(deltaS / round) * round;
	const hours = Math.floor(duration / 3600);
	const minutes = Math.floor((duration - hours * 3600) / 60);
	const seconds = Math.floor(duration - hours * 3600 - minutes * 60);
	ele("duration").innerText = `${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}`;
}

/**
 * Sets the content area UI to edit the given timesheet.
 * @param spreadsheetId String The timesheet to edit.
 * @return {Promise<void>}
 */
async function editSheet(spreadsheetId) {
	const content = ele("content");

	content.innerHTML = `
<div id="submitTimeEntryContainer" style="display: none" class="modal">
	<div class="panel">
		<div class="titleBar">
			<div id="submitTimeEntryTitle" class="label"></div>
			<div class="close">&times;</div>
		</div>
		<a id="deleteEntryLink" class="withIcon" style="cursor: pointer; margin-top: 7px;"><i class="material-icons">delete</i> Delete Entry</a>
		<form id="submitTimeEntryForm">
			<input type="hidden" id="spreadsheetId" value="${spreadsheetId}">
			<input type="hidden" id="rowId" value="-1">
			
			<label for="dateStart">Date Start</label>
			<input type="date" id="dateStart" required ${DATE_FALLBACK}>
			<label for="timeStart">Time Start</label>
			<input type="time" id="timeStart" step="1" required ${TIME_FALLBACK}>

			<label for="dateEnd">Date End</label>
			<input type="date" id="dateEnd" required ${DATE_FALLBACK}>
			<label for="timeEnd">Time End</label>
			<input type="time" id="timeEnd" step="1" required ${TIME_FALLBACK}>
			
			<label for="timeResolutionsInput">Round Time to Next:</label>
			<select name="timeResolutionsInput" id="timeResolutionsInput">
				<option value="3600"/>
				1s</option>
				<option value="60">1m</option>
				<option value="12">5m</option>
				<option value="6">10m</option>
				<option value="4">15m</option>
				<option value="2">30m</option>
				<option value="1">1hr</option>
			</select>
			
			<label>Duration</label>
			<div id="duration"></div>

			<label for="category">Category</label>
			<input list="categoriesList" id="category">
			<datalist id="categoriesList">
				<option value="test"></option>
			</datalist>
			
			<label for="comment">Comment</label>
			<textarea id="comment"></textarea>

			<label></label>
			<input type="submit">
		</form>
	</div>
</div>

<div>
	<div class="documentInfoBar"><h2 id="title"></h2><a id="documentLink"><img src="images/drive.svg"></a> </div>
	<p><a href='#list' class="withIcon"><i class="material-icons">keyboard_backspace</i> Back to List</a></p>
	<div class="controls">
		<button id="startTimerBtn" class="withIcon" style="display: none;"><i class="material-icons">play_circle_outline</i> Start Timer</button>
		<button id="stopTimerBtn" class="withIcon" style="display: none;"><i class="material-icons">pause_circle_outline</i> Stop Timer</button>
		<div id="timerDisplay"></div>
	</div>
</div>
<p></p>
<div id="timesheetTableContainer">
	<table id="timesheetTable">
		<thead>
		<tr>
			<th>Start Time</th>
			<th>End Time</th>
			<th>Hours</th>
			<th>Category</th>
			<th>Comment</th>
		</tr>
		</thead>
		<tbody>
		</tbody>
	</table>
</div>`;
	ele("startTimerBtn").onclick = startTimerClickedHandler.bind(this, spreadsheetId);
	ele("stopTimerBtn").onclick = stopTimerClickedHandler.bind(this, spreadsheetId);

	const timeResolutionsInput = ele("timeResolutionsInput");
	timeResolutionsInput.onchange = async (e) => {
		appProperties.timeResolution = parseInt(timeResolutionsInput.value);
		await utils.updateProperties(spreadsheetId, { timeResolution: timeResolutionsInput.value });
	}

	modal.initModal(ele("submitTimeEntryContainer"));

	const submitForm = ele("submitTimeEntryForm");
	submitForm.onsubmit = (e) => {
		loadInc();
		submitTimeEntryFormHandler().finally(()=> {
			loadDec();
		});
		return false;
	};
	ele("deleteEntryLink").onclick = () => {
		loadInc();
		const spreadsheetId = ele("spreadsheetId").value;
		const rowId = parseInt(ele("rowId").value);
		modal.closeModal(ele("submitTimeEntryContainer"));
		deleteRow(spreadsheetId, rowId);
		loadDec();
	}
	submitForm.querySelectorAll("input,select").forEach((input) => {
		input.addEventListener("change", updateDuration);
	});

	await refreshTimesheet(spreadsheetId);
}

export default editSheet;