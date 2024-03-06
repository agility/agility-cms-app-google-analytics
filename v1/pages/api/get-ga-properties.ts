// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'

import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/get-authenticated-client';
import { IOAuthToken } from '../install';



type Data = {
	id: string
	name: string
	accountId: string
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data[]>
  ) {
	const filter = `${req.query.filter}` || "";
	const oauthToken: IOAuthToken = req.body.oAuthToken;
	const oauth2Client = getAuthenticatedClient();
	oauth2Client.setCredentials(oauthToken);
  
	// Instantiate the Google Analytics Admin API
	const admin = google.analyticsadmin('v1alpha');
  
	try {

	  // Fetch the list of GA4 properties
	  const properties = await admin.properties.list({

		// Note: Filter by parent (Account ID) if needed, syntax "accounts/{accountId}"
		// For GA4, the account ID might be part of the property ID in the format "properties/{propertyId}"
		filter: `parent:${filter}`,
		auth: oauth2Client,
	  });
	  
	  // Extract the account ID from the filter
	  const accountId = filter.split("/").pop() || "";

	  // Transform the response to match the desired format
	  const retVal = properties.data.properties?.map((property) => ({
		id: property.name || "", // The "name" field includes the full property ID including "properties/" prefix
		name: property.displayName || "",
		accountId: accountId, // or extract from property.parent
	  })) || [];
  
	  res.status(200).json(retVal);
	} catch (error) {
	  console.error(error);
	  // @ts-ignore
	  res.status(500).json({ error: "Failed to fetch GA4 properties." });
	}
  }