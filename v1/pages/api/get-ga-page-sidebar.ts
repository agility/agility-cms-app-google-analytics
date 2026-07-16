// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next"
import { CHART_DURATIONS } from "@/constants"
import { IOAuthToken } from "../install"
import { google } from "googleapis"

import { BetaAnalyticsDataClient } from "@google-analytics/data"

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
	const duration = `${req.query.duration}` || "7daysAgo"
	const profileId = `${req.query.profileId}` || "" // GA4 Property ID
	const pagePath = `${req.query.pagePath ?? ""}` // The path of the page we want analytics for

	if (!pagePath) {
		res.status(400).send("A pagePath is required to fetch page analytics.")
		return
	}

	const oauthToken: IOAuthToken = req.body.oAuthToken

	const authClient = new google.auth.OAuth2()
	authClient.setCredentials({
		access_token: oauthToken.access_token,
		refresh_token: oauthToken.refresh_token
	})

	//@ts-ignore
	const analyticsDataClient = new BetaAnalyticsDataClient({ authClient: authClient })

	// Keep the metric order in sync with GoogleLineChart's expectations:
	// 0: activeUsers, 1: newUsers, 2: screenPageViews, 3: userEngagementDuration
	const metrics = [
		{ name: "activeUsers" },
		{ name: "newUsers" },
		{ name: "screenPageViews" },
		{ name: "userEngagementDuration" }
	]

	const dimensionName = duration === CHART_DURATIONS["365daysAgo"] ? "month" : "date"

	try {
		const [response] = await analyticsDataClient.runReport({
			property: `properties/${profileId}`,
			dateRanges: [
				{
					startDate: duration,
					endDate: "today"
				}
			],
			metrics: metrics,
			dimensions: [{ name: dimensionName }],
			// Restrict the report to a single page by its path.
			dimensionFilter: {
				filter: {
					fieldName: "pagePath",
					stringFilter: {
						matchType: "EXACT",
						value: pagePath,
						caseSensitive: false
					}
				}
			},
			orderBys: [
				{
					dimension: {
						dimensionName
					}
				}
			]
		})
		res.status(200).json(response)
	} catch (err: any) {
		console.error("Error calling GA4 Data API", err)
		res.status(400).send("Error in GA4 Data API call: " + err.message)
	}
}
