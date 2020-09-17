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

/**
 * Creates a new Spreadsheet with the header and formatting.
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
					properties: {
						title: "Timesheet",
						sheetId: 0,
						index: 0
					}
				},
				{
					properties: {
						title: "Billing",
						sheetId: 1,
						index: 1
					}
				}
			],
		},
	});

	console.debug("newSheetResponse", newSheetResponse);
	const spreadsheetId = newSheetResponse.result.spreadsheetId;

	function freezeHeader(sheetId) {
		return {
			updateSheetProperties: {
				properties: {
					sheetId: sheetId,
					gridProperties: {
						frozenRowCount: 1
					}
				},
				fields: "gridProperties.frozenRowCount"
			}
		}
	}

	function boldHeader(sheetId) {
		return {
			repeatCell: {
				range: {
					sheetId: sheetId,
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
		}
	}

	// Format header row to be bold and frozen, and the date columns formatted.
	const formatResponse = await gapi.client.sheets.spreadsheets.batchUpdate({
		spreadsheetId: spreadsheetId,
		requests: [
			freezeHeader(0),
			boldHeader(0),
			freezeHeader(1),
			boldHeader(1),
			{
				repeatCell: {
					range: {
						startRowIndex: 1,
						startColumnIndex: 0,
						endColumnIndex: 2
					},
					cell: {
						userEnteredFormat: {
							numberFormat: {
								type: "DATE_TIME",
								pattern: "yyyy-mm-dd hh:mm:ss"
							}
						}
					},
					fields: "userEnteredFormat.numberFormat"
				}
			},
			{
				repeatCell: {
					range: {
						startRowIndex: 1,
						startColumnIndex: 2,
						endColumnIndex: 3
					},
					cell: {
						userEnteredFormat: {
							numberFormat: {
								type: "TIME",
								pattern: "[h]:mm:ss"
							}
						}
					},
					fields: "userEnteredFormat.numberFormat"
				}
			},
			{
				repeatCell: {
					range: {
						sheetId: 1,
						startColumnIndex: 3,
						endColumnIndex: 4,
						startRowIndex: 1
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
			// Rate:
			{
				repeatCell: {
					range: {
						sheetId: 1,
						startColumnIndex: 4,
						endColumnIndex: 5,
						startRowIndex: 1,
						endRowIndex: 2
					},
					cell: {
						userEnteredFormat: {
							numberFormat: {
								type: "NUMBER",
								pattern: "#,##0.00"
							}
						}
					},
					fields: "userEnteredFormat.numberFormat"
				}
			},
			{
				// Total paid and total billed
				repeatCell: {
					range: {
						sheetId: 1,
						startColumnIndex: 4,
						endColumnIndex: 5,
						startRowIndex: 2,
						endRowIndex: 6
					},
					cell: {
						userEnteredFormat: {
							numberFormat: {
								type: "CURRENCY"
							}
						}
					},
					fields: "userEnteredFormat.numberFormat"
				}
			}
		]
	});
	console.debug("formatResponse", formatResponse);

	const timesheetDataRequest = {
		spreadsheetId: spreadsheetId,
		range: `A1:E1`,
		valueInputOption: 'USER_ENTERED',

		includeValuesInResponse: false,

		resource: {
			values: [
				[
					"Start Date",
					"End Date",
					"Duration",
					"Category",
					"Comment"
				]
			]
		}
	};

	const timesheetDataResponse = (await gapi.client.sheets.spreadsheets.values.append(timesheetDataRequest));
	console.debug("timesheetDataResponse", timesheetDataResponse);

	const billingDataRequest = {
		spreadsheetId: spreadsheetId,
		range: `Billing!A1:E1`,
		valueInputOption: 'USER_ENTERED',
		includeValuesInResponse: false,

		resource: {
			values: [
				// A1:E1
				[
					"Date",
					"Paid Amount",
				],
				// A2:E2
				[
					null,
					null,
					null,
					"Total Hours:",
					"=SUM(Timesheet!C:C*24)"
				],
				// A3:E3
				[
					null,
					null,
					null,
					"Rate:",
					"100"
				],
				// A4:E4
				[
					null,
					null,
					null,
					"Total Paid:",
					"=SUM(B:B)"
				],
				// A5:E5
				[
					null,
					null,
					null,
					"Total Billed:",
					"=E2*E3"
				],
				// A6:E6
				[
					null,
					null,
					null,
					"Balance:",
					"=E5-E4"
				]
			]
		}
	};

	const billingDataResponse = (await gapi.client.sheets.spreadsheets.values.append(billingDataRequest));
	console.debug("billingDataResponse", billingDataResponse);

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
	});
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
 *
 * @param spreadsheetId String
 * @param startTime Date
 * @param endTime Date
 * @param category String A short string categorizing the time entry's sub-project.
 * @param comment String
 * @param timeResolution number
 * @return {Promise<void>}
 */
export async function appendTimeEntry(spreadsheetId, startTime, endTime, category, comment, timeResolution) {
	const appendRequest = {
		// The ID of the spreadsheet to update.
		spreadsheetId: spreadsheetId,

		// The A1 notation of a range to search for a logical table of data.
		// Values are appended after the last row of the table.
		range: "A1:E1",

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
					`=CEILING((B${row}-A${row}), 1 / 24 / ${timeResolution})`,
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
 * Updates an existing timesheet entry.
 *
 * @param spreadsheetId String
 * @param rowIndex The index of the time row being updated. This is zero indexed, not counting the header row.
 * @param startTime Date
 * @param endTime Date
 * @param category String A short string categorizing the time entry's sub-project.
 * @param comment String
 * @param timeResolution number
 * @return {Promise<void>}
 */
export async function updateTimeEntry(spreadsheetId, rowIndex, startTime, endTime, category, comment, timeResolution) {
	const row = rowIndex + 2;
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
					dateTimeFormula(startTime),
					dateTimeFormula(endTime),
					`=CEILING((B${row}-A${row}), 1 / 24 / ${timeResolution})`,
					category,
					comment
				]
			]
		}
	};

	const updateResponse = (await gapi.client.sheets.spreadsheets.values.update(updateRequest));
	console.debug("Update time entry", updateResponse);
}

/**
 * Returns a sheets formula representing the given date.
 * @param date Date
 */
export function dateTimeFormula(date) {
	return `=DATE(${date.getUTCFullYear()}, ${date.getUTCMonth() + 1}, ${date.getUTCDate()}) + TIME(${date.getUTCHours()}, ${date.getUTCMinutes()}, ${date.getUTCSeconds()})`
}

/**
 * Sets the metadata on the timesheet to indicate the start time of the timer.
 * @param spreadsheetId String The id of the spreadsheet.
 * @param startTime Date | null
 * @return {Promise<*>} Returns a Promise with the the files.update response.
 */
export function updateStartTime(spreadsheetId, startTime) {
	return updateProperties(spreadsheetId, {
		startTime: (startTime == null) ? null : startTime.getTime()
	});
}

/**
 * Gets the Drive file metadata..
 * @param spreadsheetId
 * @return {Promise<*>} Returns a Promise where the result is the drive File metadata.
 */
export async function getFileMetadata(spreadsheetId) {
	console.log("file meta...");
	return await gapi.client.drive.files.get({
		fileId: spreadsheetId,
		fields: "appProperties, name, webViewLink"
	});
}

/**
 * Updates the spreadsheet's app properties.
 * @param spreadsheetId
 * @param appProperties
 * @return {Promise<*>} Returns a Promise with the files.update response.
 */
export function updateProperties(spreadsheetId, appProperties) {
	return gapi.client.drive.files.update({
		fileId: spreadsheetId,
		appProperties: appProperties
	});
}

export async function deleteRow(spreadsheetId, rowIndex) {
	const request = {
		spreadsheetId: spreadsheetId,
		requests: [
			{
				deleteRange: {
					range: {
						startRowIndex: rowIndex + 1,
						endRowIndex: rowIndex + 2,
						startColumnIndex: 0
					},
					shiftDimension: "ROWS"
				}
			}
		]
	};
	const deleteResponse = await gapi.client.sheets.spreadsheets.batchUpdate(request);
	console.debug("deleteResponse", deleteResponse);
	return deleteResponse;
}