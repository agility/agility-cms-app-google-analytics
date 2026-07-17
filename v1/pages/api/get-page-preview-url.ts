// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next"
import * as mgmtApi from "@agility/management-sdk"

/**
 * Resolve a page's real preview URL via the Management API:
 *   {region}/api/v1/instance/{guid}/{locale}/page/previewUrl/{pageID}
 * The SDK has no typed method for this endpoint, but its ClientInstance already
 * handles region resolution + bearer auth, so we call it through executeGet.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
	const { token, guid, pageID, locale } = req.body ?? {}

	if (!token || !guid || !pageID || !locale) {
		res.status(400).json({ error: "token, guid, pageID and locale are required." })
		return
	}

	try {
		const api = new mgmtApi.ApiClient({ token } as mgmtApi.Options)
		const apiPath = `${locale}/page/previewUrl/${pageID}?digitalChannelDomainID=0`
		const resp = await api.pageMethods._clientInstance.executeGet(apiPath, `${guid}`, `${token}`)

		const data = resp.data
		const previewUrl =
			typeof data === "string" ? data : data?.url ?? data?.previewUrl ?? data?.previewURL ?? ""

		res.status(200).json({ previewUrl })
	} catch (err: any) {
		console.error("Error fetching preview URL from Management API", err?.message ?? err)
		res.status(400).json({ error: "Unable to fetch preview URL.", detail: err?.message })
	}
}
