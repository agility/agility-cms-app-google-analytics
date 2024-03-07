import { useEffect, useState } from "react"
import axios from "axios"
import LineChartComponent, { Report } from "../components/GoogleLineChart"
import GoogleAnalyticsLogo from "../components/GoogleAnalyticsLogo"
import DurationPicker from "../components/DurationPicker"

import GoogleAnalyticsPanel from "../components/GoogleAnalyticsPanel"
import { CHART_DURATIONS } from "@/constants"
import { useAgilityAppSDK, setHeight, configMethods } from "@agility/app-sdk"
import { IOAuthToken } from "./install"

import numeral from "numeral"
import Loader from "@/components/Loader"
import { Duration } from "luxon"

// function to get the cumulative number of users
function getCumulativeActiveUsers(report: Report) {
	let cumulativeUsers = 0

	if (!report?.rows) return "0"

	report.rows.forEach((row) => {
		cumulativeUsers += parseInt(row.metricValues[0].value)
	})

	return numeral(cumulativeUsers).format("0.0a")
}

// function to get the cumulative number of new users
function getCumulativeNewUsers(report: Report) {
	let cumulativeNewUsers = 0
	if (!report?.rows) return cumulativeNewUsers
	report.rows.forEach((row) => {
		cumulativeNewUsers += parseInt(row.metricValues[1].value)
	})

	if (cumulativeNewUsers > 1000) {
		cumulativeNewUsers = numeral(cumulativeNewUsers).format("0.0a")
	}

	return cumulativeNewUsers
}

// function to get the cumulative number of pageviews
function getCumulativePageviews(report: Report) {
	let cumulativePageviews = 0
	if (!report?.rows) return cumulativePageviews
	report.rows.forEach((row) => {
		cumulativePageviews += parseInt(row.metricValues[2].value)
	})

	if (cumulativePageviews > 1000) {
		cumulativePageviews = numeral(cumulativePageviews).format("0.0a")
	}

	return cumulativePageviews
}

/**
 * Session duration in Milliseconds
 * @param report
 * @returns
 */
function getCumulativeSessionDuration(report: Report) {
	let cumulativeSessionDuration = 0
	if (!report?.rows) return "0"
	report.rows.forEach((row) => {
		cumulativeSessionDuration += parseInt(row.metricValues[3].value)
	})

	const val = cumulativeSessionDuration / report.rows.length
	const dur = Duration.fromMillis(val)
	if (val > 60000) {
		return dur.toFormat("m'm' s's'")
	} else {
		return dur.toFormat("s's'")
	}
}

export default function HomeDashboard() {
	const { appInstallContext } = useAgilityAppSDK()

	const [duration, setDuration] = useState(CHART_DURATIONS["30daysAgo"])
	const [reportData, setReportData] = useState<Report | null>(null)

	const [isActiveUserViewSelected, setIsActiveUserViewSelected] = useState(true)
	const [isNewUserViewSelected, setIsNewUserViewSelected] = useState(false)
	const [isPageDurationViewSelected, setIsPageDurationViewSelected] = useState(false)
	const [isPageViewSelected, setIsPageViewSelected] = useState(false)

	const [cumulativeActiveUsers, setCumulativeActiveUsers] = useState("0")
	const [cumulativeNewUsers, setCumulativeNewUsers] = useState(0)
	const [cumulativePageviews, setCumulativePageviews] = useState(0)
	const [cumulativeSessionDuration, setCumulativeSessionDuration] = useState("0")

	const [oAuthToken, setOAuthToken] = useState<IOAuthToken | null>(null)
	const [profileId, setProfileId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setHeight({ height: 550 })
	}, [])

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
						//the token was expired, so we needed to update it
						token.access_token = response.data.access_token
						token.expiry_date = token.expiry_date + response.data.expires_in
						configMethods.updateConfigurationValue({
							name: "Google Analytics Account",
							value: JSON.stringify(token)
						})
					} else if (response.status === 204) {
						//the token is still valid
						setOAuthToken(token)
					} else {
						//something else happened...
						setError("There was a problem accessing Google Analytics.")
					}
				})
				.catch((error) => {
					console.log(error)
					setOAuthToken(token)
				})
			setProfileId(appInstallContext.configuration["profileId"])
		}
	}, [appInstallContext])

	useEffect(() => {
		if (!profileId || !duration || !oAuthToken) return

		axios({
			method: "post",
			url: `/api/get-ga-home-dashboard?profileId=${profileId}&duration=${duration}`,
			data: { oAuthToken }
		})
			.then((response) => {
				if (response?.data) {
					const data: Report = response.data
					console.log(data)
					setReportData(data)
				} else {
					setError("There was a problem accessing the report data.")
				}
			})
			.catch((error) => {
				setError("There was a problem accessing the the report data.")
				console.log(error)
			})
	}, [duration, oAuthToken, profileId])

	useEffect(() => {
		if (!reportData) return

		const cumulativeActiveUsers = getCumulativeActiveUsers(reportData)
		const cumulativeNewUsers = getCumulativeNewUsers(reportData)
		const cumulativePageviews = getCumulativePageviews(reportData)
		const cumulativeSessionDuration = getCumulativeSessionDuration(reportData)

		setCumulativeActiveUsers(cumulativeActiveUsers)
		setCumulativeNewUsers(cumulativeNewUsers)
		setCumulativePageviews(cumulativePageviews)
		setCumulativeSessionDuration(cumulativeSessionDuration)
	}, [reportData])

	const renderReport = () => {
		if (reportData) {
			return (
				<LineChartComponent
					reportData={reportData}
					isActiveUserViewSelected={isActiveUserViewSelected}
					isNewUserViewSelected={isNewUserViewSelected}
					isPageViewSelected={isPageViewSelected}
					isPageDurationViewSelected={isPageDurationViewSelected}
					duration={duration}
				/>
			)
		} else {
			return (
				<div
					style={{
						width: "100%",
						height: 360,
						display: "flex",
						justifyContent: "center"
					}}
				>
					<Loader />
				</div>
			)
		}
	}

	return (
		<div className="overflow-hidden">
			<div className="flex flex-row items-center justify-between pb-4">
				<div className="left-element flex flex-row items-center">
					<GoogleAnalyticsLogo />
					<h1 className="ml-4 text-2xl font-medium text-gray-500">Analytics</h1>
				</div>
				<div className="right-element ml-auto items-center">
					<DurationPicker onChange={setDuration} currentDuration={duration} />
				</div>
			</div>
			<div className="mb-8 flex justify-between">
				<GoogleAnalyticsPanel
					title={"Active Users"}
					dataDisplay={`${cumulativeActiveUsers}`}
					isSelected={isActiveUserViewSelected}
					setSelected={setIsActiveUserViewSelected}
				/>
				<GoogleAnalyticsPanel
					title={"New Users"}
					dataDisplay={`${cumulativeNewUsers}`}
					isSelected={isNewUserViewSelected}
					setSelected={setIsNewUserViewSelected}
				/>
				<GoogleAnalyticsPanel
					title={"Page Views"}
					dataDisplay={`${cumulativePageviews}`}
					isSelected={isPageViewSelected}
					setSelected={setIsPageViewSelected}
				/>
				<GoogleAnalyticsPanel
					title={"Avg. Engagement Time"}
					dataDisplay={cumulativeSessionDuration}
					isSelected={isPageDurationViewSelected}
					setSelected={setIsPageDurationViewSelected}
				/>
			</div>

			{error ? (
				<div className="mt-40 flex h-full w-full items-center justify-center">
					<p>{error}</p>
				</div>
			) : (
				renderReport()
			)}
		</div>
	)
}
