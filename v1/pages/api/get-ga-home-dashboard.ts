// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next"
import { CHART_DURATIONS } from "@/constants"
import { IOAuthToken } from "../install"
import { google } from "googleapis"

import { BetaAnalyticsDataClient } from '@google-analytics/data';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
    const duration = `${req.query.duration}` || "7daysAgo";
    const profileId = `${req.query.profileId}` || ""; // Ensure you use GA4 Property ID here
    
    const oauthToken: IOAuthToken = req.body.oAuthToken

	const authClient = new google.auth.OAuth2();
	authClient.setCredentials({
		access_token: oauthToken.access_token,
		// Optionally, set the refresh token if your application can handle the refresh process
		refresh_token: oauthToken.refresh_token,
	});

	// Instantiate the BetaAnalyticsDataClient with the custom auth client
	//@ts-ignore
	const analyticsDataClient = new BetaAnalyticsDataClient({authClient: authClient});

    // Adjust the metrics and dimensions according to GA4 requirements
    const metrics = [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'userEngagementDuration' },
    ];

    // GA4 does not use viewId; it uses propertyId
    const dimensions = [
        { name: duration === CHART_DURATIONS["365daysAgo"] ? 'month' : 'date' },
    ];

    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${profileId}`,
            dateRanges: [
                {
                    startDate: duration,
                    endDate: 'today',
                },
            ],
            metrics: metrics,
            dimensions: dimensions,
        });
        res.status(200).json(response);
    } catch (err: any) {
        console.error("Error calling GA4 Data API", err);
        res.status(400).send("Error in GA4 Data API call: " + err.message);
    }
}