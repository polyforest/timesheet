import * as utils from "./timesheetServiceUtils.js"
import * as modal from "./modal.js"

let appProperties = {};

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
 * @return {HTMLTableRowElement}
 */
function createTimeRow(index, row) {
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
		openSubmitForm(ele("spreadsheetId").value, index, new Date(Date.parse(startTimeTd.innerText)), new Date(Date.parse(endTimeTd.innerText)), categoryTd.innerText, commentsTd.innerText);
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
		console.log("fileMetadata", response);
		const properties = response.result.appProperties || {}
		const startTime = properties.startTime || null;
		updateTimerUi(startTime && new Date(Number(startTime)));

		ele("timeResolutionsInput").value = !!properties.timeResolution ? properties.timeResolution.toString() : "4";
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
			const tr = createTimeRow(i, row);
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

async function stopTimerClickedHandler(spreadsheetId) {
	openSubmitForm(spreadsheetId, -1, timer.startTime, new Date(), "", "");
	updateTimerUi(null);
	await utils.updateStartTime(spreadsheetId, null);
}

/**
 * Formats a date as yyyy-mm-dd, according to https://xkcd.com/1179/
 *
 * @param date {Date}
 * @return {string}
 */
function formatDate(date) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`
}

/**
 * Formats a time as hh:mm:ss (24 hour format)
 *
 * @param time {Date}
 * @return {string}
 */
function formatTime(time) {
	return `${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(time.getSeconds(), 2)}`;
}

/**
 * Formats a UTC datetime as yyyy-mm-dd hh:mm:ss (24 hour format)
 *
 * @param date {Date}
 * @return {string}
 */
function formatUtcDateTime(date) {
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)} ${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}`
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
	ele("spreadsheetId").value = spreadsheetId;
	ele("rowId").value = rowId;
	ele("dateStart").value = formatDate(startTime);
	ele("timeStart").value = formatTime(startTime);
	ele("dateEnd").value = formatDate(endTime);
	ele("timeEnd").value = formatTime(endTime);
	ele("category").value = category || "";
	ele("comment").value = comment || "";

	modal.openModal(ele("submitTimeEntryContainer"));
	updateDuration();
}

async function submitTimeEntryFormHandler() {
	const rowId = parseInt(ele("rowId").value);
	const startTime = new Date(ele("dateStart").valueAsNumber + ele("timeStart").valueAsNumber);
	const endTime = new Date(ele("dateEnd").valueAsNumber + ele("timeEnd").valueAsNumber);
	const spreadsheetId = ele("spreadsheetId").value;
	const cat = ele("category").value;
	const comment = ele("comment").value;
	modal.closeModal(ele("submitTimeEntryContainer"));
	const tableBody = query("#timesheetTable > tbody");
	if (rowId === -1) {
		await utils.appendTimeEntry(spreadsheetId, startTime, endTime, cat, comment, appProperties.timeResolution || 4);
		tableBody.appendChild(createTimeRow(tableBody.childElementCount, [formatUtcDateTime(startTime), formatUtcDateTime(endTime), ele("duration").innerText, cat, comment]));
	} else {
		await utils.updateTimeEntry(spreadsheetId, rowId, startTime, endTime, cat, comment, appProperties.timeResolution || 4);
		const previousRow = tableBody.childNodes[rowId];
		tableBody.insertBefore(createTimeRow(rowId, [formatUtcDateTime(startTime), formatUtcDateTime(endTime), ele("duration").innerText, cat, comment]), previousRow);
		tableBody.removeChild(previousRow);
	}
}

/**
 * Sets the duration display to be the time difference rounded to the next time resolution value.
 */
function updateDuration() {
	const deltaS = (ele("dateEnd").valueAsNumber + ele("timeEnd").valueAsNumber - (ele("dateStart").valueAsNumber + ele("timeStart").valueAsNumber)) / 1000;
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
			<div class="label">New Time Entry</div>
			<div class="close">&times;</div>
		</div>
		<form id="submitTimeEntryForm">
			<input type="hidden" id="spreadsheetId" value="${spreadsheetId}">
			<input type="hidden" id="rowId" value="-1">
			
			<label for="dateStart">Date Start</label>
			<input type="date" id="dateStart" required>
			<label for="timeStart">Time Start</label>
			<input type="time" id="timeStart" step="1" required>

			<label for="dateEnd">Date End</label>
			<input type="date" id="dateEnd" required>
			<label for="timeEnd">Time End</label>
			<input type="time" id="timeEnd" step="1" required>
			
			<label for="timeResolutionsInput">Round Time to Next:</label>
			<select name="timeResolutionsInput" id="timeResolutionsInput">
				<option value="3600"/>
				1s</option>
				<option value="60">1m</option>
				<option value="12">5m</option>
				<option value="6">10m</option>
				<option value="4" selected>15m</option>
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
		console.log(timeResolutionsInput.value);
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
	submitForm.querySelectorAll("input,select").forEach((input) => {
		input.addEventListener("change", updateDuration);
	});

	await refreshTimesheet(spreadsheetId);
}

export default editSheet;
