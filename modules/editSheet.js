import { appendTimeEntry, getStartTime, stopTimer, startTimer } from "./timesheetServiceUtils.js"

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

/**
 * Refreshes the timer buttons display.
 * @param spreadsheetId String
 */
async function refreshTimerButtons(spreadsheetId) {
	const time = await getStartTime(spreadsheetId)
	ele("startTimerBtn").style.display = (time == null) ? "" : "none"
	ele("stopTimerBtn").style.display = (time == null) ? "none" : ""
}

/**
 * Refreshes the timesheet table data.
 * @param spreadsheetId String
 * @return {Promise<void>}
 */
async function refreshTimesheet(spreadsheetId) {
	const body = query("#timesheetTable > tbody");

	const response = await gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId: spreadsheetId,
		range: "A2:D"
	});

	body.innerHTML = ""
	if (response.result.values !== undefined) {
		for (let i = 0; i < response.result.values.length; i++) {
			const row = response.result.values[i];
			const tr = createTimeRow(i, row);
			body.appendChild(tr);
		}
	}

	console.debug("spreadsheets.values response", response);
}

/**
 * Sets the content area UI to edit the given timesheet.
 * @param spreadsheetId String The timesheet to edit.
 * @return {Promise<void>}
 */
async function editSheet(spreadsheetId) {
	const content = ele("content");

	content.innerHTML = `<p><a href='#list'>< List</a></p>
<button id="startTimerBtn" style="display: none;">Start Timer</button>
<button id="stopTimerBtn" style="display: none;">Stop Timer</button>
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

	await refreshTimerButtons(spreadsheetId);

	ele("startTimerBtn").onclick = async () => {
		await startTimer(spreadsheetId);
		await refreshTimerButtons(spreadsheetId);
	}
	ele("stopTimerBtn").onclick = async () => {
		const startTime = await getStartTime(spreadsheetId);
		if (!!startTime) {
			await appendTimeEntry(spreadsheetId, startTime, new Date(), "Group", "Comment");
			await stopTimer(spreadsheetId)
			await refreshTimerButtons(spreadsheetId);
			await refreshTimesheet(spreadsheetId);
		}
	}

	await refreshTimesheet(spreadsheetId);
}

export default editSheet;
