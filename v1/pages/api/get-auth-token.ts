// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { getOauth2Client } from '@/lib/get-oauth2-client';
import type { NextApiRequest, NextApiResponse } from 'next'


type Data = {
	tokens: any
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {

	const code = req.body.code || ""
	const oauth2Client = getOauth2Client()

	const { tokens } = await oauth2Client.getToken(code)


	res.status(200).json({ tokens })
}
