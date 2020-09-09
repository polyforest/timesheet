
/**
 * Adds a timesheet row to the table body.
 */
function createTimeRow(index, row) {
	const tr = document.createElement("tr");

	const dateTd = document.createElement("td");
	dateTd.innerHTML = row[0] || "";
	tr.appendChild(dateTd);

	const hoursTd = document.createElement("td");
	hoursTd.innerHTML = row[1] || "";
	tr.appendChild(hoursTd);

	const categoryTd = document.createElement("td");
	categoryTd.innerHTML = row[2] || "";
	tr.appendChild(categoryTd);

	const commentsTd = document.createElement("td");
	commentsTd.innerHTML = row[3] || "";
	commentsTd.tabIndex = 0;
	commentsTd.onfocus = () => {

	}
	tr.appendChild(commentsTd);

	return tr;
}

/**
 * Sets the content area UI to edit the given timesheet.
 * @param spreadsheetId String The timesheet to edit.
 * @return {Promise<void>}
 */
export default async function editSheet(spreadsheetId) {
	const content = ele("content");

	content.innerHTML = `<p><a href='#list'>< List</a></p>
<div id="timesheetTableContainer">
	<table id="timesheetTable">
		<thead>
		<tr>
			<th>Date</th>
			<th>Hours</th>
			<th>Category</th>
			<th>Comment</th>
		</tr>
		</thead>
		<tbody>
		</tbody>
	</table>
</div>`;

	const body = query("#timesheetTable > tbody");

	const response = await gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId: spreadsheetId,
		range: "A2:D"
	});

	if (response.result.values !== undefined) {
		for (let i = 0; i < response.result.values.length; i++) {
			const row = response.result.values[i];
			const tr = createTimeRow(i, row);
			body.appendChild(tr);
		}
	}

	console.log("values response", response);
}
