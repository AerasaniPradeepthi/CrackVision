package com.crackvision.backend.exception;

public class AiServiceException extends RuntimeException {

    private final boolean isTimeout;

    public AiServiceException(String message, boolean isTimeout) {
        super(message);
        this.isTimeout = isTimeout;
    }

    public AiServiceException(String message, Throwable cause, boolean isTimeout) {
        super(message, cause);
        this.isTimeout = isTimeout;
    }

    public boolean isTimeout() {
        return isTimeout;
    }
}
