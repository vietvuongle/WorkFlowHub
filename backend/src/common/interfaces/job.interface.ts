export interface IEmailJob {
  email: string;
}

export interface IVerifyEmailJob extends IEmailJob {
  token: string;
}

export interface IPasswordResetJob extends IEmailJob {
  token: string;
}
