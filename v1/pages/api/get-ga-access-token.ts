// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios';

interface IOAuthToken {
	access_token: string
	refresh_token: string
	token_type: string
	expiry_date: number
}

function isTokenExpired(token: IOAuthToken) {
	const expiryDate = token.expiry_date;
	const currentTime = new Date().getTime();
	return currentTime >= expiryDate;
  }
  
  async function getNewAccessToken(refreshToken: string) {
	const refreshTokenUrl = 'https://www.googleapis.com/oauth2/v4/token';
	const clientId = process.env.GOOGLE_CLIENT_ID
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  
	try {
	  const response = await axios.post(refreshTokenUrl, {
		refresh_token: refreshToken,
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'refresh_token'
	  });
  
	  return response.data;
	} catch (error) {
	  console.error('Error refreshing access token:', error);
	  throw error;
	}
  }
  

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<string>
) {
	const oauthToken: IOAuthToken = req.body.oAuthToken

	if (isTokenExpired(oauthToken)) {
		const newAccessToken = await getNewAccessToken(oauthToken.refresh_token);
		// Return the new access token to the client
		res.status(200).json(newAccessToken);


	} else {
		res.status(204).json(oauthToken.access_token)
	}

}