/*
 * Copyright 2020 Poly Forest, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createTimesheet, getTimesheetFolderId } from "./timesheetServiceUtils.js"
import * as modal from "./modal.js"

/**
 * Handles the submit from the new spreadsheet form.
 */
function newSpreadsheetFormSubmitHandler() {
	const name = ele("spreadSheetName").value;
	console.log(`Creating timesheet '${name}'`);
	loadInc();
	createTimesheet(name).then((spreadsheetId) => {
		console.log("Created timesheet", spreadsheetId);
		window.location.href = `#sheet/${spreadsheetId}`;
	}, (e) => {
		uncaughtErrorHandler(e);
	}).finally(()=> {
		loadDec();
	});
	modal.closeModal(ele("newSpreadsheetContainer"));
	return false;
}

function openNewSpreadsheetForm() {
	ele('newSpreadsheetContainer').style.display = '';
	ele('spreadSheetName').focus();
}


/**
 * The content area will display a list of all non-trashed sheets within the folders named "Timesheets".
 */
async function timesheetsList() {
	const content = ele("content");

	content.innerHTML = `

<div class="documentInfoBar"><h2>All Timesheets</h2><a id="documentLink"><img src="images/drive.svg"></a> </div>
<div id="newSpreadsheetContainer" style="display: none" class="modal">
	<div class="panel">
		<div class="titleBar">
			<div class="label">Create Timesheet</div>
			<div class="close">&times;</div>
		</div>
		<form id="newSpreadsheetForm" action="#list/">
			<label>Name:</label>
			<input id="spreadSheetName" type="text" required>
			<label></label>
			<input type="submit">
		</form>
	</div>
</div>

<p id="loading">Loading...</p>
<p id="noTimesheets" style="display: none">You do not currently have any timesheets.</p>

<ul id="timesheetsList"></ul>

<button id="newTimesheetButton">Create New Timesheet</button>
`;

	ele("newTimesheetButton").onclick = () => {
		openNewSpreadsheetForm();
	};

	modal.initModal(ele("newSpreadsheetContainer"));

	ele("newSpreadsheetForm").onsubmit = newSpreadsheetFormSubmitHandler;

	const ul = ele("timesheetsList");

	const timesheetFolderId = await getTimesheetFolderId();
	ele("documentLink").href = `https://drive.google.com/drive/u/0/folders/${timesheetFolderId}`

	const timesheetsResponse = await gapi.client.drive.files.list({
		"q": `mimeType != 'application/vnd.google-apps.folder' and trashed = false`
	});

	console.debug("timesheetsResponse", timesheetsResponse);
	for (const timesheet of timesheetsResponse.result.files) {
		const li = document.createElement("li");
		ul.appendChild(li);
		const a = document.createElement("a");
		a.innerText = timesheet.name;
		a.href = "#sheet/" + timesheet.id;
		li.appendChild(a);
	}

	ele("loading").style.display = "none";
	ele("noTimesheets").style.display = (timesheetsResponse.result.files.length === 0) ? "" : "none";
}

export default timesheetsList;