/**
 * Zaim API OAuth 1.0a認証セットアップスクリプト
 *
 * このスクリプトはZaim APIのOAuth 1.0a認証フローを実行し、
 * Access TokenとAccess Token Secretを取得します。
 *
 * 使用方法:
 *   npx ts-node scripts/oauth-setup.ts
 *
 * 必要な環境変数:
 *   ZAIM_CONSUMER_KEY: Zaim APIのConsumer Key
 *   ZAIM_CONSUMER_SECRET: Zaim APIのConsumer Secret
 */

import crypto from 'crypto';
import readline from 'readline';

// OAuth 1.0a パラメータを正規化する（RFC 5849準拠）
function normalizeParameters(parameters: Record<string, string>): string {
  return Object.entries(parameters)
    .map(([key, value]) => [
      encodeURIComponent(key),
      encodeURIComponent(value)
    ])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

// OAuth 1.0a ベース文字列を構築する（RFC 5849準拠）
function constructBaseString(
  method: string,
  url: string,
  normalizedParams: string
): string {
  return [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(normalizedParams)
  ].join('&');
}

// OAuth 1.0a 署名キーを構築する（RFC 5849準拠）
function constructSigningKey(
  consumerSecret: string,
  tokenSecret?: string
): string {
  const encodedConsumerSecret = encodeURIComponent(consumerSecret);
  const encodedTokenSecret = tokenSecret ? encodeURIComponent(tokenSecret) : '';
  return `${encodedConsumerSecret}&${encodedTokenSecret}`;
}

// OAuth 1.0a HMAC-SHA1署名を生成する（RFC 5849準拠）
function generateOAuthSignature(
  method: string,
  url: string,
  parameters: Record<string, string>,
  consumerSecret: string,
  tokenSecret?: string
): string {
  const normalizedParams = normalizeParameters(parameters);
  const baseString = constructBaseString(method, url, normalizedParams);
  const signingKey = constructSigningKey(consumerSecret, tokenSecret);

  return crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');
}

// ワンタイムトークン（nonce）を生成
function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// タイムスタンプを生成
function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

// OAuth Authorizationヘッダーを構築
function buildAuthorizationHeader(oauthParams: Record<string, string>): string {
  const headerParts = Object.entries(oauthParams)
    .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
    .join(', ');
  return `OAuth ${headerParts}`;
}

// ユーザー入力を受け取る
async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// OAuth認証フローのメイン処理
async function main() {
  console.log('='.repeat(60));
  console.log('Zaim API OAuth 1.0a認証セットアップ');
  console.log('='.repeat(60));
  console.log('');

  // Step 0: 認証情報の取得
  const consumerKey = process.env.ZAIM_CONSUMER_KEY || 'a9991336c8b3721fddc73f87fe3bc78cfeac001c';
  const consumerSecret = process.env.ZAIM_CONSUMER_SECRET || 'fff98f7b98a7f6f54e2587e58d0dba6ddc29616a';

  if (!consumerKey || !consumerSecret) {
    console.error('エラー: ZAIM_CONSUMER_KEYとZAIM_CONSUMER_SECRETが必要です。');
    process.exit(1);
  }

  console.log(`Consumer Key: ${consumerKey}`);
  console.log('');

  // Step 1: リクエストトークンの取得
  console.log('[Step 1] リクエストトークンの取得');
  console.log('-'.repeat(60));

  const requestTokenUrl = 'https://api.zaim.net/v2/auth/request';
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_version: '1.0',
    oauth_callback: 'oob', // Out-of-Band（ローカル実行のため）
  };

  const signature = generateOAuthSignature(
    'POST',
    requestTokenUrl,
    oauthParams,
    consumerSecret
  );

  const oauthParamsWithSignature = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const authHeader = buildAuthorizationHeader(oauthParamsWithSignature);

  try {
    const response = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'Zaim-OAuth-Setup/1.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`エラー: リクエストトークンの取得に失敗しました。`);
      console.error(`HTTPステータス: ${response.status}`);
      console.error(`レスポンス: ${errorText}`);
      process.exit(1);
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      console.error('エラー: リクエストトークンの解析に失敗しました。');
      console.error(`レスポンス: ${responseText}`);
      process.exit(1);
    }

    console.log('✓ リクエストトークンの取得に成功しました。');
    console.log(`  OAuth Token: ${oauthToken}`);
    console.log(`  OAuth Token Secret: ${oauthTokenSecret}`);
    console.log('');

    // Step 2: 認証URLの表示
    console.log('[Step 2] ブラウザでZaim認証');
    console.log('-'.repeat(60));
    const authUrl = `https://auth.zaim.net/users/auth?oauth_token=${oauthToken}`;
    console.log('以下のURLをブラウザで開いて、認証を行ってください:');
    console.log('');
    console.log(authUrl);
    console.log('');

    // Step 3: Verifierの入力
    console.log('[Step 3] Verifier（PINコード）の入力');
    console.log('-'.repeat(60));
    const oauthVerifier = await promptUser('認証後に表示されたVerifier（PINコード）を入力してください: ');

    if (!oauthVerifier) {
      console.error('エラー: Verifierが入力されませんでした。');
      process.exit(1);
    }

    console.log('');

    // Step 4: アクセストークンの取得
    console.log('[Step 4] アクセストークンの取得');
    console.log('-'.repeat(60));

    const accessTokenUrl = 'https://api.zaim.net/v2/auth/access';
    const accessOauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: generateNonce(),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: generateTimestamp(),
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
      oauth_version: '1.0',
    };

    const accessSignature = generateOAuthSignature(
      'POST',
      accessTokenUrl,
      accessOauthParams,
      consumerSecret,
      oauthTokenSecret
    );

    const accessOauthParamsWithSignature = {
      ...accessOauthParams,
      oauth_signature: accessSignature,
    };

    const accessAuthHeader = buildAuthorizationHeader(accessOauthParamsWithSignature);

    const accessResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': accessAuthHeader,
        'User-Agent': 'Zaim-OAuth-Setup/1.0',
      },
    });

    if (!accessResponse.ok) {
      const errorText = await accessResponse.text();
      console.error(`エラー: アクセストークンの取得に失敗しました。`);
      console.error(`HTTPステータス: ${accessResponse.status}`);
      console.error(`レスポンス: ${errorText}`);
      process.exit(1);
    }

    const accessResponseText = await accessResponse.text();
    const accessParams = new URLSearchParams(accessResponseText);
    const accessToken = accessParams.get('oauth_token');
    const accessTokenSecret = accessParams.get('oauth_token_secret');

    if (!accessToken || !accessTokenSecret) {
      console.error('エラー: アクセストークンの解析に失敗しました。');
      console.error(`レスポンス: ${accessResponseText}`);
      process.exit(1);
    }

    console.log('✓ アクセストークンの取得に成功しました！');
    console.log('');

    // Step 5: 結果の表示
    console.log('='.repeat(60));
    console.log('認証完了 - 以下の情報を.envファイルに保存してください');
    console.log('='.repeat(60));
    console.log('');
    console.log('ZAIM_CONSUMER_KEY=' + consumerKey);
    console.log('ZAIM_CONSUMER_SECRET=' + consumerSecret);
    console.log('ZAIM_ACCESS_TOKEN=' + accessToken);
    console.log('ZAIM_ACCESS_TOKEN_SECRET=' + accessTokenSecret);
    console.log('');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('エラー: ネットワークエラーが発生しました。');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// スクリプトの実行
main().catch((error) => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
});
