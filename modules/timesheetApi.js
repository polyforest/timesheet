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
											stringValue: "Date"
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
	const timesheetFolder = await getTimesheetFolderId();
	gapi.client.drive.files.update({
		fileId: newSheetResponse.result.spreadsheetId,
		addParents: timesheetFolder.id,
		fields: 'id, parents'
	});
	return newSheetResponse.result.spreadsheetId;
}

/**
 * Creates or returns the timesheets folder.
 * @return Promise<String>
 */
export async function getTimesheetFolderId() {
	const response = await gapi.client.drive.files.list({
		"q": "name = 'Timesheets' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
	})
	if (response.result.files.length > 0) return response.result.files[0].id;

	const newFolderResponse = await gapi.client.drive.files.create({
		resource: {
			'name': 'Timesheets',
			'mimeType': 'application/vnd.google-apps.folder'
		},
		fields: 'id'
	});
	console.log(newFolderResponse);
	return newFolderResponse.result.id;
}