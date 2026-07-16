import { useEffect, useState } from "react"
import axios from "axios"
import { Duration } from "luxon"
import numeral from "numeral"

import LineChartComponent, { Report } from "../components/GoogleLineChart"
import GoogleAnalyticsLogo from "../components/GoogleAnalyticsLogo"
import DurationPicker from "../components/DurationPicker"
import Loader from "@/components/Loader"

import { CHART_DURATIONS } from "@/constants"
import { useAgilityAppSDK, setHeight, configMethods, pageMethods, IPageItem } from "@agility/app-sdk"
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

const metricColors: { [key: string]: string } = {
	users: "#4600AA",
	newUsers: "#691AD8",
	pageViews: "#BC99EE",
	avgSessionDuration: "#111827"
}

interface StatTileProps {
	title: string
	dataDisplay: string
	metricKey: keyof typeof metricColors
	isSelected: boolean
	setSelected: (value: boolean) => void
}

function StatTile({ title, dataDisplay, metricKey, isSelected, setSelected }: StatTileProps) {
	const color = metricColors[metricKey]
	return (
		<div
			onClick={() => setSelected(!isSelected)}
			className="flex cursor-pointer flex-col justify-between rounded-md border bg-white p-3 transition duration-150 hover:border-gray-300"
			style={{ borderColor: isSelected ? color : "#e5e7eb" }}
		>
			<span className="text-xs text-dashboard-title">{title}</span>
			<span className="pt-1 text-xl" style={{ color }}>
				{dataDisplay}
			</span>
			<div
				className="mt-2 h-1 w-full rounded transition duration-300 ease-in-out"
				style={{ backgroundColor: isSelected ? color : "transparent" }}
			/>
		</div>
	)
}

export default function PageSidebar() {
	const { appInstallContext, initializing } = useAgilityAppSDK()

	// The SDK hook's `pageItem` is never populated (it's a no-op in the SDK), so
	// we request the full page item explicitly via pageMethods.getPageItem().
	const [pageItem, setPageItem] = useState<IPageItem | null>(null)

	const [duration, setDuration] = useState(CHART_DURATIONS["7daysAgo"])
	const [reportData, setReportData] = useState<Report | null>(null)

	const [isActiveUserViewSelected, setIsActiveUserViewSelected] = useState(true)
	const [isNewUserViewSelected, setIsNewUserViewSelected] = useState(false)
	const [isPageDurationViewSelected, setIsPageDurationViewSelected] = useState(false)
	const [isPageViewSelected, setIsPageViewSelected] = useState(false)

	const [cumulativeActiveUsers, setCumulativeActiveUsers] = useState("0")
	const [cumulativeNewUsers, setCumulativeNewUsers] = useState("0")
	const [cumulativePageviews, setCumulativePageviews] = useState("0")
	const [cumulativeSessionDuration, setCumulativeSessionDuration] = useState("0")

	const [oAuthToken, setOAuthToken] = useState<IOAuthToken | null>(null)
	const [profileId, setProfileId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const pagePath = normalizePagePath(pageItem?.PagePath ?? null)

	useEffect(() => {
		setHeight({ height: 640 })
	}, [])

	// Fetch the current page once the SDK has finished its initialize handshake.
	useEffect(() => {
		if (initializing) return
		const result = pageMethods.getPageItem()
		if (result) {
			result.then((pi) => setPageItem((pi as IPageItem) ?? null)).catch(() => {})
		}
	}, [initializing])

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
					setReportData(response.data as Report)
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
		return <Loader />
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

		return (
			<>
				<div className="mb-4 grid grid-cols-2 gap-2">
					<StatTile
						title="Active Users"
						dataDisplay={cumulativeActiveUsers}
						metricKey="users"
						isSelected={isActiveUserViewSelected}
						setSelected={setIsActiveUserViewSelected}
					/>
					<StatTile
						title="New Users"
						dataDisplay={cumulativeNewUsers}
						metricKey="newUsers"
						isSelected={isNewUserViewSelected}
						setSelected={setIsNewUserViewSelected}
					/>
					<StatTile
						title="Page Views"
						dataDisplay={cumulativePageviews}
						metricKey="pageViews"
						isSelected={isPageViewSelected}
						setSelected={setIsPageViewSelected}
					/>
					<StatTile
						title="Avg. Engagement Time"
						dataDisplay={cumulativeSessionDuration}
						metricKey="avgSessionDuration"
						isSelected={isPageDurationViewSelected}
						setSelected={setIsPageDurationViewSelected}
					/>
				</div>
				<LineChartComponent
					reportData={reportData}
					isActiveUserViewSelected={isActiveUserViewSelected}
					isNewUserViewSelected={isNewUserViewSelected}
					isPageViewSelected={isPageViewSelected}
					isPageDurationViewSelected={isPageDurationViewSelected}
					duration={duration}
				/>
			</>
		)
	}

	return (
		<div className="overflow-hidden p-1">
			<div className="flex flex-row items-center pb-2">
				<GoogleAnalyticsLogo />
				<h1 className="ml-3 text-xl font-medium text-gray-500">Page Analytics</h1>
			</div>

			{pagePath ? (
				<p className="mb-3 truncate text-sm text-gray-400" title={pagePath}>
					{pagePath}
				</p>
			) : (
				<p className="mb-3 text-sm text-gray-400">This page has no path yet.</p>
			)}

			<div className="mb-4">
				<DurationPicker onChange={setDuration} currentDuration={duration} />
			</div>

			{renderBody()}
		</div>
	)
}
