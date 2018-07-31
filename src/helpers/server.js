export class ServerError {
  constructor(message = 'Server error', status = 500) {
    this.message = message;
    this.status = status;
  }
}

export const ForbiddenError = msg => {
  return new ServerError(msg ? msg : 'Forbidden', 403);
};

export const BadRequestError = msg => {
  return new ServerError(msg ? msg : 'Bad request', 400);
};

export const NotFoundError = msg => {
  return new ServerError(msg ? msg : 'Not found', 404);
};
