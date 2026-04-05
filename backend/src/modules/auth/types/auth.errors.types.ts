export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = "Invalid username or password") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export class UsernameAlreadyExistsError extends AuthError {
  constructor(message = "Username is already in use") {
    super(message);
    this.name = "UsernameAlreadyExistsError";
  }
}

export class EmailAlreadyExistsError extends AuthError {
  constructor(message = "Email is already in use") {
    super(message);
    this.name = "EmailAlreadyExistsError";
  }
}

export class AccountCreationError extends AuthError {
  constructor(message = "Failed to create account") {
    super(message);
    this.name = "AccountCreationError";
  }
}

export class AccountNotFoundError extends AuthError {
  constructor(message = "Account not found") {
    super(message);
    this.name = "AccountNotFoundError";
  }
}

export class AccountDeletionBlockedError extends AuthError {
  constructor(message = "Account deletion is blocked by existing organization data") {
    super(message);
    this.name = "AccountDeletionBlockedError";
  }
}
