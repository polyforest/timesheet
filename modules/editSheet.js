import * as utils from "./timesheetServiceUtils.js"

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

		 ele("timeResolutionsInput").value = properties.timeResolution || "4";
		 appProperties = properties;
	 });

	const valuesResponse = await gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId: spreadsheetId,
		range: "A2:D"
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
	const endTime = new Date();
	const elapsedMs = endTime - timer.startTime;
	console.log("elapsedMs: " + elapsedMs)

	const startTime = timer.startTime;
	updateTimerUi(null);
	await utils.updateStartTime(spreadsheetId, null);
	await utils.appendTimeEntry(spreadsheetId, startTime, endTime, "Category", "Comment", appProperties.timeResolution || 4);
	await refreshTimesheet(spreadsheetId);
}

/**
 * Sets the content area UI to edit the given timesheet.
 * @param spreadsheetId String The timesheet to edit.
 * @return {Promise<void>}
 */
async function editSheet(spreadsheetId) {
	const content = ele("content");

	content.innerHTML = `<p><a href='#list'>< List</a></p>
<div>
	<button id="startTimerBtn" style="display: none;">Start Timer</button>
	<button id="stopTimerBtn" style="display: none;">Stop Timer</button>
	<div id="timerDisplay"></div>
	
	<label for="timeResolutionsInput">Time Resolution:</label>
	<select name="timeResolutionsInput" id="timeResolutionsInput">
		<option value="3600"/>0:00:01</option>
		<option value="60">0:01</option>
		<option value="4" selected>0:15</option>
		<option value="2">0:30</option>
		<option value="1">1:00</option>
	</select>
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
		appProperties.timeResolution = timeResolutionsInput.value;
		await utils.updateProperties(spreadsheetId, { timeResolution: timeResolutionsInput.value });
	}

	await refreshTimesheet(spreadsheetId);
}

export default editSheet;
