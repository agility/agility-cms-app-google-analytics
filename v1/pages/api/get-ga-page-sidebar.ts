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

	// Sparkline/tile metrics. Index order matters — the client reads these positionally:
	// 0: activeUsers, 1: newUsers, 2: screenPageViews, 3: userEngagementDuration, 4: bounceRate
	const seriesMetrics = [
		{ name: "activeUsers" },
		{ name: "newUsers" },
		{ name: "screenPageViews" },
		{ name: "userEngagementDuration" },
		{ name: "bounceRate" }
	]

	const dimensionName = duration === CHART_DURATIONS["365daysAgo"] ? "month" : "date"

	// Restrict every report to this single page.
	const pagePathFilter = {
		filter: {
			fieldName: "pagePath",
			stringFilter: {
				matchType: "EXACT" as const,
				value: pagePath,
				caseSensitive: false
			}
		}
	}

	// Current window is `duration`..today (N+1 days). The previous window is the
	// same length immediately before it, for period-over-period comparison.
	const days = parseInt(duration) || 7
	const currentRange = { startDate: duration, endDate: "today" }
	const previousRange = { startDate: `${days * 2 + 1}daysAgo`, endDate: `${days + 1}daysAgo` }

	const compareMetricNames = ["activeUsers", "newUsers", "screenPageViews", "userEngagementDuration", "bounceRate"]

	try {
		const [[seriesResponse], [compareResponse], [sourcesResponse]] = await Promise.all([
			// 1) Time series for the sparklines + tile totals.
			analyticsDataClient.runReport({
				property: `properties/${profileId}`,
				dateRanges: [currentRange],
				metrics: seriesMetrics,
				dimensions: [{ name: dimensionName }],
				dimensionFilter: pagePathFilter,
				orderBys: [{ dimension: { dimensionName } }]
			}),
			// 2) Current-vs-previous totals for the deltas (no date dimension -> one row per range).
			analyticsDataClient.runReport({
				property: `properties/${profileId}`,
				dateRanges: [currentRange, previousRange],
				metrics: compareMetricNames.map((name) => ({ name })),
				dimensionFilter: pagePathFilter
			}),
			// 3) Top traffic channels driving views to this page.
			analyticsDataClient.runReport({
				property: `properties/${profileId}`,
				dateRanges: [currentRange],
				dimensions: [{ name: "sessionDefaultChannelGroup" }],
				metrics: [{ name: "screenPageViews" }],
				dimensionFilter: pagePathFilter,
				orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
				limit: 5
			})
		])

		// Fold the comparison report (2 rows tagged by dateRange) into { metric: { current, previous } }.
		const compare: { [metric: string]: { current: number; previous: number } } = {}
		compareMetricNames.forEach((name) => (compare[name] = { current: 0, previous: 0 }))
		;(compareResponse.rows ?? []).forEach((row) => {
			// With multiple date ranges GA appends a `dateRange` dimension: date_range_0 (current), date_range_1 (previous).
			const rangeKey = row.dimensionValues?.[0]?.value === "date_range_1" ? "previous" : "current"
			compareMetricNames.forEach((name, i) => {
				compare[name][rangeKey] = parseFloat(row.metricValues?.[i]?.value ?? "0") || 0
			})
		})

		const sources = (sourcesResponse.rows ?? []).map((row) => ({
			channel: row.dimensionValues?.[0]?.value || "Unknown",
			views: parseInt(row.metricValues?.[0]?.value ?? "0") || 0
		}))

		res.status(200).json({
			rows: seriesResponse.rows ?? [],
			metricHeaders: seriesResponse.metricHeaders ?? [],
			dimensionHeaders: seriesResponse.dimensionHeaders ?? [],
			compare,
			sources
		})
	} catch (err: any) {
		console.error("Error calling GA4 Data API", err)
		res.status(400).send("Error in GA4 Data API call: " + err.message)
	}
}
