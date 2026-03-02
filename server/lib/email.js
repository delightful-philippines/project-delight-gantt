import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an invitation email to a new user.
 * @param {string} to - The recipient's email address.
 * @param {string} inviterName - The name of the person who invited them.
 * @param {string} role - The role assigned to them (viewer, editor, super_admin).
 */
export const sendInvitationEmail = async (to, inviterName, role) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  const mailOptions = {
    from: `"${process.env.SMTP_FROM_NAME || 'Project Delight Gantt'}" <${process.env.SMTP_FROM_EMAIL}>`,
    to,
    subject: `You've been invited to Project Delight Gantt`,
    html: `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 16px;">
        <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #2563eb; font-size: 24px; margin-bottom: 24px; font-weight: 700; text-align: center;">Welcome to the Workspace!</h1>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
            Hello,
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            <strong>${inviterName}</strong> has invited you to join <strong>Project Delight Gantt</strong> as a <strong>${role.replace('_', ' ')}</strong>.
          </p>
          
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${frontendUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
              Join Workspace
            </a>
          </div>
          
          <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
            Once you click the button above, you'll be redirected to the login page. Please sign in with your corporate account to get started.
          </p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
          
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            This invitation was sent by Project Delight Gantt. If you weren't expecting this email, you can safely ignore it.
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Invitation sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('[Email] Failed to send invitation:', error);
    throw error;
  }
};
