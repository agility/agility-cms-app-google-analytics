import axios from "axios"
import React, { useEffect, useMemo, useState } from "react"
import { setExtraConfigValues, useAgilityPreInstall, IConfig } from "@agility/app-sdk"

import ComboBox from "../components/ComboBox"
import { Button, Select, SimpleSelectOptions } from "@agility/plenum-ui"

type Property = {
	id: string
	name: string
	accountId: string
}

export interface IOAuthToken {
	access_token: string
	refresh_token: string
	token_type: string
	expiry_date: number
}

export default function Install() {
	const [properties, setProperties] = useState<Property[]>([])
	const [accounts, setAccounts] = useState<Property[]>([])

	const [selectedAccount, setSelectedAccount] = useState<Property | null>(null)
	const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
	const { initializing, appInstallContext, instance, locale } = useAgilityPreInstall()

	const [oAuthToken, setOAuthToken] = useState<IOAuthToken | null>(null)

	const configuration = appInstallContext?.configuration

	// Get the auth token from the app install context
	useEffect(() => {
		if (!configuration) return

		const str = configuration["Google Analytics Account"]
		const token = JSON.parse(str ?? "{}") as IOAuthToken
		setOAuthToken(token)
	}, [configuration])

	// get list of accounts from the API
	useEffect(() => {
		if (!oAuthToken) return
		axios({
			method: "post",
			url: "/api/get-ga-accounts",
			data: {
				oAuthToken: oAuthToken
			}
		})
			.then((response) => {
				if (response.data.length > 0) {
					setSelectedAccount(response.data[0])
				}
				setAccounts(response.data)
			})
			.catch((error) => {
				console.log(error)
			})
	}, [oAuthToken])

	// get the list of web properties from the API
	useEffect(() => {
		console.log("selectedAccount", selectedAccount)
		if (!oAuthToken || !selectedAccount?.id) return
		axios({
			method: "post",
			url: `/api/get-ga-properties?filter=${selectedAccount.id}`,
			data: {
				oAuthToken: oAuthToken
			}
		})
			.then((response) => {
				setProperties(response.data)
				if (response.data.length > 0) {
					setSelectedProperty(response.data[0])
				}
			})
			.catch((error) => {
				console.log(error)
			})

		return () => {}
	}, [oAuthToken, selectedAccount])

	const extraConfigValues = useMemo(() => {
		if (!selectedAccount) return
		if (!selectedProperty) return

		return [
			{
				Name: "accountId",
				Value: selectedAccount.id,
				Label: "Account ID",
				Type: "GoogleAnalyticsAccountId"
			},
			{
				Name: "profileId",
				Value: selectedProperty.id,
				Label: "Profile ID",
				Type: "GoogleAnalyticsProfileId"
			}
		] as IConfig[]
	}, [selectedAccount?.id, selectedProperty])

	if (initializing) {
		return <div>Loading...</div>
	}

	return (
		<div className=" flex h-[100vh] flex-col ">
			<div className="flex-1">
				<p className="mb-4 mt-4">Select a Google Analytics (GA4) account and property for us to retrieve data from.</p>
				<div className="p-1">
					{accounts && accounts.length > 0 && (
						<Select
							label="Select an Account"
							options={
								accounts?.map((p) => ({
									label: p.name,
									value: p.id
								})) || []
							}
							value={selectedAccount?.id ?? ""}
							onChange={(value) => {
								setSelectedAccount(accounts.find((a) => a.id === value) || null)
							}}
						/>
					)}
				</div>
				<div className="p-1 mt-2">
					{properties && properties.length > 0 && (
						<Select
							label="Select a property"
							options={
								properties?.map((p) => ({
									label: p.name,
									value: p.id
								})) || []
							}
							value={selectedProperty?.id ?? ""}
							onChange={(value) => {
								setSelectedProperty(properties.find((p) => p.id === value) || null)
							}}
						/>
					)}
				</div>


			</div>

			<div>
				<Button
					label="Install"
					isWidthFull
					onClick={() => setExtraConfigValues(extraConfigValues || [])}
					isDisabled={!extraConfigValues}
				/>
			</div>
		</div>
	)
}
