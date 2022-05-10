import jwt from "jsonwebtoken";

const JWT_KEY = "ssssshhhh :D";

export class Mutation {
  login(username: string, password?: string) {
    const token = jwt.sign({
      username,
      password
    }, JWT_KEY);

    return token;
  }
}
