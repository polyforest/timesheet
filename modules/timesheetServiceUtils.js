/**
 * @param title String
 * @return {Promise<String>}
 */
export async function createTimesheet(title) {
	const newSheetResponse = await gapi.client.sheets.spreadsheets.create({
		resource: {
			properties: {
				title: title
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
							},
							// {
							// 	values: [
							// 		{
							// 			userEnteredValue: {
							// 				stringValue: "1-2-2020"
							// 			}
							// 		},
							// 		{
							// 			userEnteredValue: {
							// 				stringValue: "1-3-2020 3:22:34 A.M."
							// 			}
							// 		},
							// 		{
							// 			userEnteredValue: {
							// 				stringValue: "4:22"
							// 			}
							// 		}
							//
							// 	]
							// }
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
			},
			{
				repeatCell: {
					range: {
						sheetId: sheet0Id,
						startRowIndex: 1,
						startColumnIndex: 2,
						endColumnIndex: 3
					},
					cell: {
						userEnteredFormat: {
							numberFormat: {
								type: "TIME",
								format: "h:mm"
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
 * Appends a new row to the timesheet.
 * @param spreadsheetId String
 * @return {Promise<void>}
 */
export async function appendTimeEntry(spreadsheetId) {
	const request = {
		// The ID of the spreadsheet to update.
		spreadsheetId: spreadsheetId,

		// // The A1 notation of a range to search for a logical table of data.
		// // Values are appended after the last row of the table.
		range: 'B1:E1',

		// How the input data should be interpreted.
		valueInputOption: 'RAW',

		resource: {
			values: [
				[
					0.5,
					"=C1-B1",
					group,
					comment
				]
			]
		}
	};

	const response = (await gapi.client.sheets.spreadsheets.values.append(request));
	console.debug("Append time entry", response);
}

/**
 * Converts a JS Date to Docs Serial format.
 *
 * @param date Date
 * @return {number}
 *
 * https://developers.google.com/sheets/api/reference/rest/v4/DateTimeRenderOption#ENUM_VALUES.SERIAL_NUMBER
 */
function dateToSerial(date) {
	return (date.getTime() - new Date(1899, 11, 30).getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * Converts a Docs Serial format to a JS Date.
 *
 * @param serialNumber number
 * @return {Date}
 *
 * https://developers.google.com/sheets/api/reference/rest/v4/DateTimeRenderOption#ENUM_VALUES.SERIAL_NUMBER
 */
function serialToDate(serialNumber) {
	return new Date(serialNumber * 24 * 60 * 60 * 1000 + new Date(1899, 11, 30).getTime());
}

/**
 * Sets the metadata on the timesheet to indicate the start time of the timer.
 * @param spreadsheetId
 * @return {Promise<void>}
 */
export async function startTimer(spreadsheetId) {
	const fileUpdateResponse = await gapi.client.drive.files.update({
		fileId: spreadsheetId,
		appProperties: {
			startTime: (new Date()).getTime()
		}
	});
	console.debug("fileUpdateResponse", fileUpdateResponse);
}

/**
 * Sets the metadata on the timesheet to clear the start time.
 * @param spreadsheetId
 * @return {Promise<void>}
 */
export async function stopTimer(spreadsheetId) {
	const fileUpdateResponse = await gapi.client.drive.files.update({
		fileId: spreadsheetId,
		appProperties: {
			startTime: null
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
	const getStartTimeResponse = await gapi.client.drive.files.get({
		fileId: spreadsheetId,
		fields: ["appProperties"]
	});
	console.debug("getStartTimeResponse", getStartTimeResponse);
	const time = getStartTimeResponse.result.appProperties && getStartTimeResponse.result.appProperties.startTime;
	if (!time) return null;
	else return new Date(Number(time));
}