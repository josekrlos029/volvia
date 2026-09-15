/**
 * Transactional email copy, written for Volvia in Spanish and English.
 * Kept here rather than in a JSON catalogue so template arguments stay typed.
 */
export const brandCopy = {
  es: {
    verifyEmail: {
      subject: 'Confirma tu correo en Volvia',
      title: 'Confirma tu correo',
      intro:
        'Falta un paso para activar tu cuenta. Confirma que este correo es tuyo y entras al panel.',
      cta: 'Confirmar correo',
      footnote: 'El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.',
    },
    magicLink: {
      subject: 'Tu enlace de acceso a Volvia',
      title: 'Entra sin contraseña',
      intro: 'Usa este enlace para entrar a tu panel. Solo funciona una vez.',
      cta: 'Entrar a Volvia',
      footnote: 'El enlace vence en 15 minutos. Si no lo pediste, puedes ignorarlo.',
    },
    passwordReset: {
      subject: 'Restablece tu contraseña de Volvia',
      title: 'Restablece tu contraseña',
      intro: 'Elige una contraseña nueva para tu cuenta.',
      cta: 'Crear contraseña nueva',
      footnote: 'El enlace vence en 1 hora. Si no lo pediste, tu contraseña sigue intacta.',
    },
    invite: {
      subject: (org: string) => `${org} te invitó a su equipo en Volvia`,
      title: (org: string) => `Te invitaron a ${org}`,
      intro: 'Acepta la invitación para sellar tarjetas y ver el panel del negocio.',
      cta: 'Aceptar invitación',
      footnote: 'La invitación vence en 7 días.',
    },
    customerWelcome: {
      subject: (org: string) => `Tu tarjeta de ${org} está lista`,
      title: (org: string) => `Bienvenido al club de ${org}`,
      intro: (reward: string) =>
        `Ya tienes tu tarjeta. Cuando completes los sellos, te llevas: ${reward}.`,
      cta: 'Ver mi tarjeta',
      footnote: 'Guarda este correo para volver a tu tarjeta cuando quieras.',
    },
    birthday: {
      subject: (org: string) => `${org} tiene algo para tu cumpleaños`,
      title: '¡Feliz cumpleaños!',
      intro: (org: string, offer: string) =>
        `${org} dejó algo en tu tarjeta para celebrar: ${offer}.`,
      cta: 'Ver mi tarjeta',
      footnote: 'Puedes darte de baja de estos mensajes desde tu tarjeta.',
    },
    rewardReady: {
      subject: 'Tu recompensa está lista',
      title: 'Completaste tu tarjeta',
      intro: (reward: string, org: string) =>
        `Ya puedes reclamar ${reward} en ${org}. Muestra tu tarjeta en el mostrador.`,
      cta: 'Ver mi tarjeta',
      footnote: 'Puedes darte de baja de estos mensajes desde tu tarjeta.',
    },
  },
  en: {
    verifyEmail: {
      subject: 'Confirm your email on Volvia',
      title: 'Confirm your email',
      intro: 'One step left to activate your account. Confirm this address and you are in.',
      cta: 'Confirm email',
      footnote:
        'This link expires in 24 hours. If you did not create an account, ignore this message.',
    },
    magicLink: {
      subject: 'Your Volvia sign-in link',
      title: 'Sign in without a password',
      intro: 'Use this link to open your dashboard. It works once.',
      cta: 'Sign in to Volvia',
      footnote: 'This link expires in 15 minutes. If you did not request it, ignore this message.',
    },
    passwordReset: {
      subject: 'Reset your Volvia password',
      title: 'Reset your password',
      intro: 'Choose a new password for your account.',
      cta: 'Set a new password',
      footnote:
        'This link expires in 1 hour. If you did not request it, your password is unchanged.',
    },
    invite: {
      subject: (org: string) => `${org} invited you to their team on Volvia`,
      title: (org: string) => `You are invited to ${org}`,
      intro: 'Accept the invitation to stamp cards and open the dashboard.',
      cta: 'Accept invitation',
      footnote: 'This invitation expires in 7 days.',
    },
    customerWelcome: {
      subject: (org: string) => `Your ${org} card is ready`,
      title: (org: string) => `Welcome to the ${org} club`,
      intro: (reward: string) => `Your card is live. Fill it up and it is yours: ${reward}.`,
      cta: 'Open my card',
      footnote: 'Keep this email to find your card any time.',
    },
    birthday: {
      subject: (org: string) => `${org} left something for your birthday`,
      title: 'Happy birthday!',
      intro: (org: string, offer: string) =>
        `${org} added something to your card to celebrate: ${offer}.`,
      cta: 'Open my card',
      footnote: 'You can unsubscribe from these messages on your card.',
    },
    rewardReady: {
      subject: 'Your reward is ready',
      title: 'You filled your card',
      intro: (reward: string, org: string) =>
        `You can claim ${reward} at ${org}. Show your card at the counter.`,
      cta: 'Open my card',
      footnote: 'You can unsubscribe from these messages on your card.',
    },
  },
} as const
