/**
 * @param title String
 * @return {Promise<String>}
 */
export async function createTimesheet(title) {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const newSheetResponse = await gapi.client.sheets.spreadsheets.create({
		resource: {
			properties: {
				title: title,
				timeZone: timeZone
			},
			sheets: [
				{
					data: {
						startRow: 0,
						rowData: [
							{
								values: [
									{
										userEnteredValue: {
											stringValue: "Start Date"
										}
									},
									{
										userEnteredValue: {
											stringValue: "End Date"
										}
									},
									{
										userEnteredValue: {
											stringValue: "Hours"
										}
									},
									{
										userEnteredValue: {
											stringValue: "Category"
										}
									},
									{
										userEnteredValue: {
											stringValue: "Comment"
										}
									}
								]
							}
						]
					}
				}
			],
		},
	});

	console.debug("newSheetResponse", newSheetResponse);
	const sheet0Id = newSheetResponse.result.sheets[0].properties.sheetId;

	// Format header row to be bold and frozen, and the date columns formatted.
	const formatHeaderResponse = await gapi.client.sheets.spreadsheets.batchUpdate({
		spreadsheetId: newSheetResponse.result.spreadsheetId,
		requests: [
			{
				updateSheetProperties: {
					properties: {
						sheetId: sheet0Id,
						gridProperties: {
							frozenRowCount: 1
						}
					},
					fields: "gridProperties.frozenRowCount"
				}
			},
			{
				repeatCell: {
					range: {
						sheetId: sheet0Id,
						endRowIndex: 1
					},
					cell: {
						userEnteredFormat: {
							textFormat: {
								bold: true
							}
						}
					},
					fields: "userEnteredFormat.textFormat.bold"
				}
			},
			{
				repeatCell: {
					range: {
						sheetId: sheet0Id,
						startRowIndex: 1,
						startColumnIndex: 0,
						endColumnIndex: 2
					},
					cell: {
						userEnteredFormat: {
							numberFormat: {
								type: "DATE_TIME"
							}
						}
					},
					fields: "userEnteredFormat.numberFormat"
				}
			}
		]
	});
	console.debug("formatResponse", formatHeaderResponse);

	// Add the new spreadsheet to the 'Timesheets' folder:
	const timesheetFolder = await getTimesheetFolderId();
	const fileUpdateResponse = await gapi.client.drive.files.update({
		fileId: newSheetResponse.result.spreadsheetId,
		addParents: timesheetFolder
	});
	console.debug("fileUpdateResponse", fileUpdateResponse);
	return newSheetResponse.result.spreadsheetId;
}

/**
 * Returns the first folder created by this application.
 * Creates a new folder named "Timesheets" if none exists.
 * This folder may be moved or renamed in Google Drive.
 *
 * @return Promise<String>
 */
export async function getTimesheetFolderId() {
	const response = await gapi.client.drive.files.list({
		"q": "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
	})
	if (response.result.files.length > 0) return response.result.files[0].id;

	const newFolderResponse = await gapi.client.drive.files.create({
		resource: {
			'name': 'Timesheets',
			'mimeType': 'application/vnd.google-apps.folder'
		},
		fields: 'id'
	});
	console.debug("newFolderResponse", newFolderResponse);
	return newFolderResponse.result.id;
}

/**
 * Appends a new start time to the timesheet.
 * This will be an incomplete row with just the start time column set until stop is called.
 * @param spreadsheetId String
 * @param startTime Date
 * @param endTime Date
 * @param category String
 * @param comment String
 * @return {Promise<void>}
 */
export async function appendTimeEntry(spreadsheetId, startTime, endTime, category, comment) {
	const appendRequest = {
		// The ID of the spreadsheet to update.
		spreadsheetId: spreadsheetId,

		// The A1 notation of a range to search for a logical table of data.
		// Values are appended after the last row of the table.
		range: `A1:E1`,

		// How the input data should be interpreted.
		valueInputOption: 'USER_ENTERED',

		includeValuesInResponse: false,

		resource: {
			values: [
				[
					dateTimeFormula(startTime),
					dateTimeFormula(endTime),
					null, // Needs a formula, see workaround below
					category,
					comment
				]
			]
		}
	};

	const appendResponse = (await gapi.client.sheets.spreadsheets.values.append(appendRequest));
	console.debug("Append time entry", appendResponse);

	// This is a workaround:
	// It's unclear from the documentation if it's possible to use a formula in an append
	// call that references the currently appending row.
	// In lieu of that, we check the result for the updatedRange, parse that for the row number and perform another
	// update call.
	const updatedRange = appendResponse.result.updates.updatedRange;
	const row = parseInt(updatedRange.substr(updatedRange.lastIndexOf(":E") + 2));
	console.log(row);

	// `=CEILING((B${row}-A${row}) * 24, 0.25)`

	const updateRequest = {
		// The ID of the spreadsheet to update.
		spreadsheetId: spreadsheetId,

		// The A1 notation of a range to search for a logical table of data.
		// Values are appended after the last row of the table.
		range: `A${row}:E${row}`,

		// How the input data should be interpreted.
		valueInputOption: 'USER_ENTERED',

		includeValuesInResponse: false,

		resource: {
			values: [
				[
					null,
					null,
					`=CEILING((B${row}-A${row}) * 24, 0.25)`,
					null,
					null
				]
			]
		}
	};

	const updateResponse = (await gapi.client.sheets.spreadsheets.values.update(updateRequest));
	console.debug("Update formula", updateResponse);

}

/**
 * Returns a sheets formula representing the given date.
 * @param date Date
 */
export function dateTimeFormula(date) {
	return `=DATE(${date.getFullYear()}, ${date.getMonth() + 1}, ${date.getDate()}) + TIME(${date.getHours()}, ${date.getMinutes()}, ${date.getSeconds()})`
}

/**
 * Sets the metadata on the timesheet to indicate the start time of the timer.
 * @param spreadsheetId String The id of the spreadsheet.
 * @param startTime Date | null
 * @return {Promise<void>}
 */
export async function updateStartTime(spreadsheetId, startTime) {
	const fileUpdateResponse = await gapi.client.drive.files.update({
		fileId: spreadsheetId,
		appProperties: {
			startTime: (startTime == null) ? null : startTime.getTime()
		}
	});
	console.debug("fileUpdateResponse", fileUpdateResponse);
}

/**
 * Gets the start time metadata on this spreadsheet, if set.
 * @param spreadsheetId
 * @return {Promise<Date | null>}
 */
export async function getStartTime(spreadsheetId) {
	if (spreadsheetId == null) throw Error("spreadsheetId must not be null");
	const getStartTimeResponse = await gapi.client.drive.files.get({
		fileId: spreadsheetId,
		fields: ["appProperties"]
	});
	console.debug("getStartTimeResponse", getStartTimeResponse);
	const time = getStartTimeResponse.result.appProperties && getStartTimeResponse.result.appProperties.startTime;
	if (!time) return null;
	else return new Date(Number(time));
}