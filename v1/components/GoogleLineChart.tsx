import { CHART_DURATIONS } from "@/constants"
import React, { useEffect } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Duration } from "luxon"

type MetricHeader = {
	name: string
	type: "TYPE_INTEGER" | "TYPE_FLOAT" | "TYPE_STRING" | "TYPE_BOOLEAN" | "TYPE_MONEY" | "TYPE_PERCENT" | "TYPE_SECONDS" | "TYPE_MILLISECONDS" | "TYPE_MINUTES" | "TYPE_HOURS" | "TYPE_DAYS" | "TYPE_MONTHS" | "TYPE_YEARS"
}
export interface Report {
	dimensionHeaders: {
		name: string
	}
	metricHeaders: MetricHeader[]
		rows: {
			dimensionValues: {
				value: string
			}[]
			metricValues: {
				value: string
			}[]
		}[]
}

interface Props {
	reportData: Report,
	isActiveUserViewSelected: boolean,
	isNewUserViewSelected: boolean,
	isPageViewSelected: boolean,
	isPageDurationViewSelected: boolean,
	duration: string
}

function formatDate(dateString: string) {
	const year = dateString.substring(0, 4)
	const month = dateString.substring(4, 6)
	const day = dateString.substring(6, 8)
	const date = new Date(`${year}-${month}-${day}`)
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).replace(/\//g, "/")
}

function formatMonth(monthString: string): string | null {
	const monthMap: { [key: string]: string } = {
	  '01': 'Jan',
	  '02': 'Feb',
	  '03': 'Mar',
	  '04': 'Apr',
	  '05': 'May',
	  '06': 'Jun',
	  '07': 'Jul',
	  '08': 'Aug',
	  '09': 'Sep',
	  '10': 'Oct',
	  '11': 'Nov',
	  '12': 'Dec'
	};
  
	const abbreviation = monthMap[monthString];
  
	return abbreviation || null;
  }

const LineChartComponent: React.FC<Props> = ({ reportData, isNewUserViewSelected, isActiveUserViewSelected, isPageViewSelected, isPageDurationViewSelected, duration }) => {
	const [isVisible, setIsVisible] = React.useState(false)

	const data = reportData?.rows ? reportData?.rows?.map((row) => {
		return {
			date: duration === CHART_DURATIONS["365daysAgo"] ? formatMonth(row.dimensionValues[0].value) : formatDate(row.dimensionValues[0].value),
			users: parseInt(row.metricValues[0].value),
			newUsers: parseInt(row.metricValues[1].value),
			pageViews: parseInt(row.metricValues[2].value),
			avgSessionDuration: Math.round(parseFloat(row.metricValues[3].value)),
		}
	}) : []
	  
	const formatTooltip = (value: string, name: string): any => {
		let label = ''
		switch (name) {
			case 'users': label = 'Users'; break;
			case 'newUsers': label = 'New Users'; break;
			case 'pageViews': label = 'Page Views'; break;
			case 'avgSessionDuration': label = 'Avg. Engagement Time'; break;
		}
		
		if(label === 'Avg. Engagement Time') {
			const dur = Duration.fromMillis(parseInt(value))
			if (parseInt(value) > 60000) {
				return [`${dur.toFormat("m'm' s's'")}`, label]
			} else if (parseInt(value) >= 1000){
				return [`${dur.toFormat("s's'")}`, label]
			} else {
				return [`${dur.toFormat("S'ms'")}`, label]
			}
		}

		return [value, label]
	};

	// Force an even tick stride so labels are evenly spaced instead of
	// Recharts' default auto-hiding, which bunches labels unevenly.
	const tickInterval = data.length > 15 ? Math.ceil(data.length / 15) - 1 : 0

	useEffect(() => {
		if(reportData) setIsVisible(true)
	}, [reportData])

	return (
		<ResponsiveContainer width={"96%"} height={360} className={`transition-opacity duration-650 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
			<LineChart data={data}>
				<XAxis dataKey="date" tickSize={0} tickMargin={16} interval={tickInterval} />
				<YAxis axisLine={{ stroke: "transparent" }} tickSize={0} tickMargin={16} />
				<CartesianGrid horizontal vertical={false} stroke="#eee" />
				<Tooltip formatter={formatTooltip} labelStyle={{ fontSize: 18, fontWeight:'bold' }}  />
				{isActiveUserViewSelected ? <Line type="linear" dataKey="users" stroke="#4600AA" dot={false} strokeWidth={3} /> : null}
				{isNewUserViewSelected ? <Line type="linear" dataKey="newUsers" stroke="#691AD8" dot={false} strokeWidth={3} /> : null}
				{isPageViewSelected ? <Line type="linear" dataKey="pageViews" stroke="#BC99EE" dot={false} strokeWidth={3} /> : null}
				{isPageDurationViewSelected ? <Line type="linear" dataKey="avgSessionDuration" stroke="#111827" dot={false} strokeWidth={3} /> : null}
			</LineChart>
		</ResponsiveContainer>
	)
}

export default LineChartComponent
