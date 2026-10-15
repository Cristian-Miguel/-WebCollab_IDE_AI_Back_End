
export interface AuthLoginBody {
    email: string;
    password: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
}

export interface AuthSessionContext {
    ip?: string;
    userAgent?: string;
}