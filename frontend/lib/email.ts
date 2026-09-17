// Resend Email Dispatch Helper for GeoMiner
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || 'noreply@tryagrochain.com';
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'GeoMiner';

export async function sendEmailOTP(params: {
  email: string;
  code: string;
  type: 'verification' | 'password_reset';
  fullName?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { email, code, type, fullName } = params;
    const isReset = type === 'password_reset';
    const subject = isReset
      ? `${code} is your GeoMiner password reset code`
      : `${code} is your GeoMiner verification code`;

    const titleText = isReset
      ? 'Password Reset Request'
      : 'Verify Your Email Address';

    const introText = isReset
      ? 'You recently requested to reset your password for the GeoMiner Mineral Exploration platform. Use the verification code below to set a new password:'
      : 'Welcome to GeoMiner! Please use the following 6-digit verification code to confirm your email and activate your mineral exploration workbench:';

    const greeting = fullName ? `Hello ${fullName},` : 'Hello,';

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0B0F12; width: 100%; min-height: 100vh; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; width: 100%; background-color: #10161C; border: 1px solid #1D262F; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 32px 36px 24px; border-bottom: 1px solid #1D262F; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <svg width="26" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L1 21H23L12 2Z" fill="#B7E89F" />
                    </svg>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 19px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em; display: inline-block;">GeoMiner</span>
                    <span style="display: inline-block; font-size: 10px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.12em; color: #B7E89F; margin-left: 10px; padding-left: 10px; border-left: 1px solid #2E3C4D;">Mineral Exploration</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 36px 28px;">
              <h1 style="font-size: 22px; font-weight: 600; color: #FFFFFF; margin: 0 0 16px; letter-spacing: -0.02em;">
                ${titleText}
              </h1>
              <p style="font-size: 14px; line-height: 1.6; color: #E2E8F0; margin: 0 0 16px;">
                ${greeting}
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #9EABB8; margin: 0 0 28px;">
                ${introText}
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 28px;">
                <tr>
                  <td style="background-color: #0B0F12; border: 1px solid #1D262F; border-radius: 8px; padding: 24px; text-align: center;">
                    <div style="font-size: 11px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.16em; color: #9EABB8; margin-bottom: 8px;">
                      Verification Security Code
                    </div>
                    <div style="font-size: 36px; font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-weight: 700; letter-spacing: 0.28em; color: #B7E89F; padding: 4px 0;">
                      ${code}
                    </div>
                    <div style="font-size: 12px; color: #606F7B; margin-top: 8px;">
                      ⏱ This code expires in <strong>10 minutes</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 1.5; color: #9EABB8; margin: 0 0 8px;">
                Please do not share this security code with anyone. GeoMiner personnel will never ask for your verification code.
              </p>
              <p style="font-size: 12px; line-height: 1.5; color: #606F7B; margin: 0;">
                If you did not initiate this request, you can safely ignore this email or review your account credentials.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px 28px; border-top: 1px solid #1D262F; background-color: #0B0F12; text-align: center;">
              <p style="font-size: 11px; color: #606F7B; margin: 0 0 6px;">
                © 2026 GeoMiner Geospatial Systems · Remote Sensing Exploration Platform
              </p>
              <p style="font-size: 11px; color: #606F7B; margin: 0;">
                Delivered via Resend Cloud Mail Infrastructure
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${MAIL_FROM_NAME} <${MAIL_FROM_ADDRESS}>`,
        to: [email],
        subject,
        html: htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return {
        success: false,
        error: data.message || `Resend HTTP error ${response.status}`,
      };
    }

    return {
      success: true,
      id: data.id,
    };
  } catch (err: any) {
    console.error('Email dispatch error:', err);
    return {
      success: false,
      error: err?.message || 'Unknown network error sending email',
    };
  }
}
