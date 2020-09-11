import * as utils from "./timesheetServiceUtils.js"

/**
 * Adds a timesheet row to the table body.
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

const timer = {
	startTime: null,
	updateIntervalId: null
}

/**
 * Updates the timer data.
 * @param startTime Date | null The timestamp the timer began.
 */
function updateTimer(startTime) {
	const startTimerBtn = ele("startTimerBtn");
	const stopTimerBtn = ele("stopTimerBtn");
	const timerDisplay = ele("timerDisplay");

	timer.startTime = startTime;
	if (startTime == null) {
		startTimerBtn.style.display = "";
		stopTimerBtn.style.display = "none";
		console.debug("timer.updateIntervalId " + timer.updateIntervalId);
		window.clearInterval(timer.updateIntervalId);
		timer.updateIntervalId = null;
		timerDisplay.innerText = "";
	} else {
		startTimerBtn.style.display = "none";
		stopTimerBtn.style.display = "";

		if (timer.updateIntervalId === null) {
			timer.updateIntervalId = window.setInterval(() => {
				const elapsedS = Math.round((Date.now() - startTime) / 1000);
				timerDisplay.innerText = elapsedS + "s";
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
	const valuesResponse = await gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId: spreadsheetId,
		range: "A2:D"
	});
	console.debug("spreadsheets.values response", valuesResponse);

	const rows = valuesResponse.result.values;
	updateTimesheetRows(rows);
}


function updateTimesheetRows(rows) {
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
	updateTimer(startTime);
	await utils.updateStartTime(spreadsheetId, startTime);
}

async function stopTimerClickedHandler(spreadsheetId) {
	const endTime = new Date();
	const elapsedMs = endTime - timer.startTime;
	console.log("elapsedMs: " + elapsedMs)

	const startTime = timer.startTime;
	updateTimer(null);
	await utils.updateStartTime(spreadsheetId, null);
	await utils.appendTimeEntry(spreadsheetId, startTime, endTime, "Category", "Comment");
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
<p>
	<button id="startTimerBtn" style="display: none;">Start Timer</button>
	<button id="stopTimerBtn" style="display: none;">Stop Timer</button>
	<div id="timerDisplay"></div>
</p>
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

	utils.getStartTime(spreadsheetId).then((startTime) => { updateTimer(startTime) })
	await refreshTimesheet(spreadsheetId);
}

export default editSheet;
