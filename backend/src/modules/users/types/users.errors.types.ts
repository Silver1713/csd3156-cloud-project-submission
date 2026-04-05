export class UsersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsersError";
  }
}

export class UserNotFoundError extends UsersError {
  constructor(message = "User was not found") {
    super(message);
    this.name = "UserNotFoundError";
  }
}

export class UserEmailAlreadyExistsError extends UsersError {
  constructor(message = "User email is already in use") {
    super(message);
    this.name = "UserEmailAlreadyExistsError";
  }
}

export class UserUsernameAlreadyExistsError extends UsersError {
  constructor(message = "Username is already in use") {
    super(message);
    this.name = "UserUsernameAlreadyExistsError";
  }
}
