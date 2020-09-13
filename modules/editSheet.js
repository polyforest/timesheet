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
	//commentsTd.tabIndex = 0;
	commentsTd.onfocus = () => {

	}
	tr.appendChild(commentsTd);

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
		window.clearInterval(timer.updateIntervalId);
		timer.updateIntervalId = -1;
		timerDisplay.innerText = "";
	} else {
		startTimerBtn.style.display = "none";
		stopTimerBtn.style.display = "";

		if (timer.updateIntervalId === -1) {
			timer.updateIntervalId = window.setInterval(() => {
				const elapsedS = Math.floor((Date.now() - startTime) / 1000);
				const h = Math.floor(elapsedS / 3600);
				const m = Math.floor((elapsedS % 3600) / 60);
				const s = Math.floor(elapsedS % 60);
				timerDisplay.innerText = pad(h, 2) + ":" + pad(m, 2) + ":" + pad(s, 2);
			}, 1000);
		}
	}
}

/**
 * Refreshes the timesheet table data.
 * @param spreadsheetId String
 * @return {Promise<void>}
 */
async function refreshTimesheet(spreadsheetId) {
	 const propertiesPromise = utils.getProperties(spreadsheetId).then((properties) => {
		 console.log("properties", properties);
		 const startTime = properties.startTime || null;
		 updateTimerUi(startTime && new Date(Number(startTime)));

		 ele("timeResolutionsInput").value = properties.timeResolution.toString() || "4";
		 appProperties = properties;
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
	if (rows !== undefined) {
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const tr = createTimeRow(i, row);
			tableBody.appendChild(tr);
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
	ele("dateStart").value = `${startTime.getFullYear()}-${pad(startTime.getMonth() + 1, 2)}-${pad(startTime.getDate(), 2)}`;
	ele("timeStart").value = `${pad(startTime.getHours(), 2)}:${pad(startTime.getMinutes(), 2)}:${pad(startTime.getSeconds(), 2)}`;
	ele("dateEnd").value = `${endTime.getFullYear()}-${pad(endTime.getMonth() + 1, 2)}-${pad(endTime.getDate(), 2)}`;
	ele("timeEnd").value = `${pad(endTime.getHours(), 2)}:${pad(endTime.getMinutes(), 2)}:${pad(endTime.getSeconds(), 2)}`;

	modal.openModal(ele("submitTimeEntryContainer"));
	updateDuration();
}

async function submitTimeEntryFormHandler() {
	const startTime = new Date(ele("dateStart").valueAsNumber + ele("timeStart").valueAsNumber);
	const endTime = new Date(ele("dateEnd").valueAsNumber + ele("timeEnd").valueAsNumber);
	const spreadsheetId = ele("spreadsheetId").value;
	const cat = ele("category").value;
	const comment = ele("comment").value;
	modal.closeModal(ele("submitTimeEntryContainer"));

	await utils.appendTimeEntry(spreadsheetId, startTime, endTime, cat, comment, appProperties.timeResolution || 4);
	await refreshTimesheet(spreadsheetId);
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
			<input type="hidden" id="spreadsheetId">
			<input type="hidden" id="rowId" value="-1">
			
			<label for="dateStart">Date Start</label>
			<input type="date" id="dateStart" required>
			<label for="timeStart">Time Start</label>
			<input type="time" id="timeStart" step="1" required>

			<label for="dateEnd">Date End</label>
			<input type="date" id="dateEnd" required>
			<label for="timeEnd">Time End</label>
			<input type="time" id="timeEnd" step="1" required>
			
			<label for="timeResolutionsInput">Time Rounding:</label>
			<select name="timeResolutionsInput" id="timeResolutionsInput">
				<option value="3600"/>
				0:00:01</option>
				<option value="60">0:01</option>
				<option value="4" selected>0:15</option>
				<option value="2">0:30</option>
				<option value="1">1:00</option>
			</select>
			
			<label>Duration</label>
			<div id="duration"></div>

			<label for="category">Category</label>
			<input list="categories" id="category">
			<datalist id="categories">
				<option value="Edge">
				<option value="Firefox">
				<option value="Chrome">
				<option value="Opera">
				<option value="Safari">
			</datalist>
			
			<label for="comment">Comment</label>
			<textarea id="comment"></textarea>

			<label></label>
			<input type="submit">
		</form>
	</div>
</div>

<div>
	<p><a href='#list'>< List</a></p>
	<div class="controls">
		<button id="startTimerBtn" style="display: none;">Start Timer</button>
		<button id="stopTimerBtn" style="display: none;">Stop Timer</button>
		<div id="timerDisplay"></div>
	</div>
</div>
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
		submitTimeEntryFormHandler();
		return false;
	};
	submitForm.querySelectorAll("input,select").forEach((input) => {
		input.addEventListener("change", updateDuration);
	});

	await refreshTimesheet(spreadsheetId);
}

export default editSheet;
