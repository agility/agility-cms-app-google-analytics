import { useEffect, useState } from "react"
import axios from "axios"
import { Duration } from "luxon"
import numeral from "numeral"

import { Report } from "../components/GoogleLineChart"
import DurationPicker from "../components/DurationPicker"
import Loader from "@/components/Loader"
import { LineChart, Line, ResponsiveContainer } from "recharts"

import { CHART_DURATIONS } from "@/constants"
import { useAgilityAppSDK, setHeight, configMethods, IPageItem, getManagementAPIToken } from "@agility/app-sdk"
import { IOAuthToken } from "./install"

function getCumulativeSingleMetric(report: Report, index: number) {
	let cumulative = 0
	if (!report?.rows) return "0"
	report.rows.forEach((row) => {
		cumulative += parseInt(row.metricValues[index].value)
	})

	return numeral(cumulative).format("0a")
}

/**
 * Average session duration in milliseconds, formatted for display.
 */
function getCumulativeSessionDuration(report: Report) {
	let cumulativeSessionDuration = 0
	if (!report?.rows || report.rows.length === 0) return "0"
	report.rows.forEach((row) => {
		cumulativeSessionDuration += parseInt(row.metricValues[3].value)
	})

	const val = cumulativeSessionDuration / report.rows.length
	const dur = Duration.fromMillis(val)
	if (val > 60000) {
		return dur.toFormat("m'm' s's'")
	} else if (val >= 1000) {
		return dur.toFormat("s's'")
	} else {
		return dur.toFormat("S'ms'")
	}
}

/**
 * Normalize an Agility page path to the shape Google Analytics stores in its
 * `pagePath` dimension: a leading slash, no trailing slash (except root).
 */
function normalizePagePath(path: string | null): string {
	if (!path) return ""
	let p = path.trim()
	if (!p.startsWith("/")) p = `/${p}`
	if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1)
	return p
}

/**
 * Extract the path portion of a page URL, dropping the origin and query string.
 * e.g. "https://site.com/product/headless-cms?lang=en-ca" -> "/product/headless-cms"
 */
function getPathFromUrl(url: string | null): string {
	if (!url) return ""
	try {
		return new URL(url).pathname
	} catch {
		// Not an absolute URL — strip any query string / hash from what we have.
		return url.split(/[?#]/)[0]
	}
}

const metricColors: { [key: string]: string } = {
	users: "#4600AA",
	newUsers: "#691AD8",
	pageViews: "#BC99EE",
	avgSessionDuration: "#111827",
	bounceRate: "#DB2777"
}

type MetricCompare = { current: number; previous: number }
type SourceRow = { channel: string; views: number }
type PageReport = Report & {
	compare?: { [metric: string]: MetricCompare }
	sources?: SourceRow[]
}

/** Relative % change of current vs previous; null when there is no baseline. */
function pctChange(cur?: number, prev?: number): number | null {
	if (cur === undefined || prev === undefined || !prev) return null
	return ((cur - prev) / prev) * 100
}

/** Extract a per-interval numeric series for one metric, for the tile sparkline. */
function getMetricSeries(report: Report | null, index: number): { v: number }[] {
	if (!report?.rows) return []
	return report.rows.map((row) => ({ v: parseFloat(row.metricValues[index].value) || 0 }))
}

interface StatTileProps {
	title: string
	dataDisplay: string
	metricKey: keyof typeof metricColors
	series: { v: number }[]
	delta?: number | null
	/** For metrics where a decrease is good (e.g. bounce rate), flip the delta color. */
	invertDelta?: boolean
}

function StatTile({ title, dataDisplay, metricKey, series, delta, invertDelta }: StatTileProps) {
	const color = metricColors[metricKey]
	const hasDelta = delta !== null && delta !== undefined && isFinite(delta)
	const up = hasDelta && (delta as number) >= 0
	const isGood = hasDelta ? (invertDelta ? !up : up) : false
	return (
		<div className="flex flex-col rounded-md border border-gray-200 bg-white p-3">
			<span className="text-xs text-dashboard-title">{title}</span>
			<div className="flex items-baseline justify-between gap-1">
				<span className="pt-1 text-xl" style={{ color }}>
					{dataDisplay}
				</span>
				{hasDelta ? (
					<span className="text-xs font-medium" style={{ color: isGood ? "#059669" : "#dc2626" }}>
						{up ? "▲" : "▼"} {Math.abs(Math.round(delta as number))}%
					</span>
				) : null}
			</div>
			<div className="mt-2 h-8 w-full">
				{series.length > 1 ? (
					<ResponsiveContainer width="100%" height="100%">
						<LineChart data={series} margin={{ top: 3, right: 0, bottom: 3, left: 0 }}>
							<Line
								type="monotone"
								dataKey="v"
								stroke={color}
								strokeWidth={1.5}
								dot={false}
								isAnimationActive={false}
							/>
						</LineChart>
					</ResponsiveContainer>
				) : null}
			</div>
		</div>
	)
}

export default function PageSidebar() {
	const { appInstallContext, initializing, instance } = useAgilityAppSDK()

	// The SDK hook never exposes `pageItem`, but the host sends it in the
	// `initialize` response (arg.pageItem). We capture it ourselves below.
	const [pageItem, setPageItem] = useState<IPageItem | null>(null)

	const [duration, setDuration] = useState(CHART_DURATIONS["7daysAgo"])
	const [reportData, setReportData] = useState<PageReport | null>(null)

	const [cumulativeActiveUsers, setCumulativeActiveUsers] = useState("0")
	const [cumulativeNewUsers, setCumulativeNewUsers] = useState("0")
	const [cumulativePageviews, setCumulativePageviews] = useState("0")
	const [cumulativeSessionDuration, setCumulativeSessionDuration] = useState("0")

	const [oAuthToken, setOAuthToken] = useState<IOAuthToken | null>(null)
	const [profileId, setProfileId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const [pagePath, setPagePath] = useState("")

	useEffect(() => {
		setHeight({ height: 620 })
	}, [])

	// Resolve the page's real preview URL from the Management API (the init
	// payload's URL is unreliable), then derive the GA `pagePath` from it.
	useEffect(() => {
		const guid = instance?.guid
		const pageID = pageItem?.ItemContainerID
		const locale = pageItem?.LanguageCode
		if (!guid || !pageID || !locale) return

		let cancelled = false
		;(async () => {
			try {
				const token = await getManagementAPIToken()
				if (!token) return
				const res = await axios.post("/api/get-page-preview-url", { token, guid, pageID, locale })
				const url: string = res.data?.previewUrl ?? ""
				if (!cancelled && url) setPagePath(normalizePagePath(getPathFromUrl(url)))
			} catch {
				/* leave pagePath empty; the UI shows a no-path message */
			}
		})()

		return () => {
			cancelled = true
		}
	}, [instance?.guid, pageItem?.ItemContainerID, pageItem?.LanguageCode])

	// The host delivers the page item as `arg.pageItem` in the initialize
	// message, which the SDK hook receives but never exposes. Listen for that
	// message directly and capture the page item ourselves.
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			const pi = e?.data?.arg?.pageItem
			if (pi) setPageItem(pi as IPageItem)
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	// Resolve the OAuth token (refreshing it if expired) and the GA4 property id
	// from the app configuration, mirroring the home dashboard.
	useEffect(() => {
		if (appInstallContext?.configuration["Google Analytics Account"]) {
			const token = JSON.parse(appInstallContext.configuration["Google Analytics Account"]) as IOAuthToken
			if (!token) return

			axios({
				method: "post",
				url: `/api/get-ga-access-token`,
				data: { oAuthToken: token }
			})
				.then((response) => {
					if (response.status === 200) {
						token.access_token = response.data.access_token
						token.expiry_date = token.expiry_date + response.data.expires_in
						configMethods.updateConfigurationValue({
							name: "Google Analytics Account",
							value: JSON.stringify(token)
						})
						setOAuthToken(token)
					} else if (response.status === 204) {
						setOAuthToken(token)
					} else {
						setError("There was a problem accessing Google Analytics.")
					}
				})
				.catch(() => {
					setOAuthToken(token)
				})
			setProfileId(appInstallContext.configuration["profileId"])
		}
	}, [appInstallContext])

	// Fetch the report for this specific page whenever the inputs change.
	useEffect(() => {
		if (!profileId || !duration || !oAuthToken || !pagePath) return

		setReportData(null)
		setError(null)

		axios({
			method: "post",
			url: `/api/get-ga-page-sidebar?profileId=${profileId}&duration=${duration}&pagePath=${encodeURIComponent(
				pagePath
			)}`,
			data: { oAuthToken }
		})
			.then((response) => {
				if (response?.data) {
					setReportData(response.data as PageReport)
				} else {
					setError("There was a problem accessing the report data.")
				}
			})
			.catch(() => {
				setError("There was a problem accessing the report data.")
			})
	}, [duration, oAuthToken, profileId, pagePath])

	useEffect(() => {
		if (!reportData) return

		setCumulativeActiveUsers(getCumulativeSingleMetric(reportData, 0))
		setCumulativeNewUsers(getCumulativeSingleMetric(reportData, 1))
		setCumulativePageviews(getCumulativeSingleMetric(reportData, 2))
		setCumulativeSessionDuration(getCumulativeSessionDuration(reportData))
	}, [reportData])

	if (initializing) {
		return (<div>hello?</div>)
	}

	if (!appInstallContext) {
		return (
			<div className="mt-40 flex h-full w-full items-center justify-center">
				<p>Unable to connect to Agility CMS.</p>
			</div>
		)
	}

	const hasData = !!reportData?.rows && reportData.rows.length > 0

	const renderBody = () => {
		if (error) {
			return (
				<div className="mt-20 flex h-full w-full items-center justify-center">
					<p className="text-center text-sm text-gray-500">{error}</p>
				</div>
			)
		}

		if (!reportData) {
			return (
				<div className="flex h-64 w-full items-center justify-center">
					<Loader />
				</div>
			)
		}

		if (!hasData) {
			return (
				<div className="mt-16 flex h-full w-full items-center justify-center">
					<p className="text-center text-sm text-gray-500">
						No analytics data found for this page in the selected date range.
					</p>
				</div>
			)
		}

		const compare = reportData.compare ?? {}
		const bouncePct = Math.round((compare.bounceRate?.current ?? 0) * 100)
		const sources = reportData.sources ?? []
		const maxViews = Math.max(...sources.map((s) => s.views), 1)

		return (
			<>
				<div className="grid grid-cols-1 gap-4">
					<StatTile
						title="Active Users"
						dataDisplay={cumulativeActiveUsers}
						metricKey="users"
						series={getMetricSeries(reportData, 0)}
						delta={pctChange(compare.activeUsers?.current, compare.activeUsers?.previous)}
					/>
					<StatTile
						title="New Users"
						dataDisplay={cumulativeNewUsers}
						metricKey="newUsers"
						series={getMetricSeries(reportData, 1)}
						delta={pctChange(compare.newUsers?.current, compare.newUsers?.previous)}
					/>
					<StatTile
						title="Page Views"
						dataDisplay={cumulativePageviews}
						metricKey="pageViews"
						series={getMetricSeries(reportData, 2)}
						delta={pctChange(compare.screenPageViews?.current, compare.screenPageViews?.previous)}
					/>
					<StatTile
						title="Avg. Engagement Time"
						dataDisplay={cumulativeSessionDuration}
						metricKey="avgSessionDuration"
						series={getMetricSeries(reportData, 3)}
						delta={pctChange(compare.userEngagementDuration?.current, compare.userEngagementDuration?.previous)}
					/>
					<StatTile
						title="Bounce Rate"
						dataDisplay={`${bouncePct}%`}
						metricKey="bounceRate"
						series={getMetricSeries(reportData, 4)}
						delta={pctChange(compare.bounceRate?.current, compare.bounceRate?.previous)}
						invertDelta
					/>
				</div>

				{sources.length > 0 ? (
					<div className="mt-4">
						<span className="text-xs font-medium text-dashboard-title">Top sources</span>
						<div className="mt-2 flex flex-col gap-1">
							{sources.map((s) => (
								<div key={s.channel} className="flex items-center gap-2 text-xs">
									<span className="w-24 shrink-0 truncate text-gray-500" title={s.channel}>
										{s.channel}
									</span>
									<div className="h-2 flex-1 rounded bg-gray-100">
										<div
											className="h-2 rounded"
											style={{ width: `${(s.views / maxViews) * 100}%`, backgroundColor: "#691AD8" }}
										/>
									</div>
									<span className="w-10 shrink-0 text-right text-gray-500">{numeral(s.views).format("0a")}</span>
								</div>
							))}
						</div>
					</div>
				) : null}

				{profileId ? (
					<a
						className="mt-4 inline-block text-xs font-medium text-agility-purple hover:underline"
						href={`https://analytics.google.com/analytics/web/#/p${profileId}/reports/intelligenthome`}
						target="_blank"
						rel="noopener noreferrer"
					>
						Open in Google Analytics ↗
					</a>
				) : null}
			</>
		)
	}

	return (
		<div className="overflow-hidden p-1">
			<div className="justify-between flex w-full mb-4">
				{pagePath ? (
					<p className="mb-3 truncate text-lg text-gray-400" title={pagePath}>
						{pagePath}
					</p>
				) : (
					<p className="mb-3 text-sm text-gray-400">This page has no path yet.</p>
				)}
				<DurationPicker onChange={setDuration} currentDuration={duration} />
			</div>
			{renderBody()}
		</div>
	)
}
