import { Dropdown, IItemProp } from "@agility/plenum-ui"
import { BsChevronDown } from "react-icons/bs"
import { CHART_DURATIONS } from "@/constants"

interface Props {
	onChange: (duration: string) => void
	currentDuration: string
}

function getDurationLabel(duration: string) {
	switch (duration) {
		case CHART_DURATIONS["7daysAgo"]:
			return "7 days ago"
		case CHART_DURATIONS["30daysAgo"]:
			return "1 month ago"
		case CHART_DURATIONS["365daysAgo"]:
			return "1 year ago"
		default:
			return "7 days ago"
	}
}

export default function DurationPicker({ onChange, currentDuration }: Props) {
	const durations: IItemProp[][] = [
		[{ label: "7 days ago", key: "7d", onClick: () => onChange(CHART_DURATIONS["7daysAgo"]) }],
		[{ label: "1 month ago", key: "1m", onClick: () => onChange(CHART_DURATIONS["30daysAgo"]) }],
		[{ label: "1 year ago", key: "1y", onClick: () => onChange(CHART_DURATIONS["365daysAgo"]) }]
	]
	//lang selection
	return (
		<Dropdown
			className="!w-auto"
			id="duration-picker"
			label={getDurationLabel(currentDuration)}
			items={durations}
			CustomDropdownTrigger={<BsChevronDown className="ml-2" />}
		/>
	)
}
