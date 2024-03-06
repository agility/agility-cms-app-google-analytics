// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/get-authenticated-client';
import { IOAuthToken } from '../install';



type Data = {
	id: string | null | undefined,
	name: string | null | undefined
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data[]>
) {
	const oauthToken: IOAuthToken = req.body.oAuthToken;
	const oauth2Client = getAuthenticatedClient();
	oauth2Client.setCredentials(oauthToken);
  
	// Instantiate the Google Analytics Admin API
	const admin = google.analyticsadmin('v1alpha');

	const accounts = await admin.accounts.list({
		auth: oauth2Client,
	});
	
	const retVal = accounts?.data?.accounts?.map((account) => {
		return {
			id: account.name,
			name: account.displayName
		}
	}) || []


	res.status(200).json(retVal)
}
