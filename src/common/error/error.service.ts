import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Logger } from '../../utils/logger';
import { AppException } from '../../utils/http-exception';
import { FastifyRequest } from 'fastify';

@Injectable()
export class ErrorService {
  errorThrower(
    statusCode: number,
    errorData?: {
      details?: any;
      message?: string;
      request?: FastifyRequest;
    },
  ) {
    const errorMap: Record<
      number,
      { statusCode: number; errorCode: string; message: string }
    > = {
      // 4xx Client Errors
      400: {
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'ERR_DELTA_1700',
        message: 'Bad request error!',
      },
      401: {
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'ERR_DELTA_1701',
        message: 'Oops! Try again later.',
      },
      402: {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        errorCode: 'ERR_DELTA_1702',
        message: 'You need to make a payment for this service.',
      },
      403: {
        statusCode: HttpStatus.FORBIDDEN,
        errorCode: 'ERR_DELTA_1703',
        message: 'Security issue. Please contact support!',
      },
      404: {
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'ERR_DELTA_1704',
        message: 'No record found.',
      },
      405: {
        statusCode: HttpStatus.METHOD_NOT_ALLOWED,
        errorCode: 'ERR_DELTA_1705',
        message: 'You are not authorized for this request.',
      },
      406: {
        statusCode: HttpStatus.NOT_ACCEPTABLE,
        errorCode: 'ERR_DELTA_1706',
        message: 'This request is not acceptable.',
      },
      407: {
        statusCode: HttpStatus.PROXY_AUTHENTICATION_REQUIRED,
        errorCode: 'ERR_DELTA_1707',
        message: 'Your connection is not authenticated.',
      },
      408: {
        statusCode: HttpStatus.REQUEST_TIMEOUT,
        errorCode: 'ERR_DELTA_1708',
        message: 'Request timeout! Please try again later.',
      },
      409: {
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'ERR_DELTA_1709',
        message:
          'This information is already in use. Please try something different.',
      },
      410: {
        statusCode: HttpStatus.GONE,
        errorCode: 'ERR_DELTA_1710',
        message: 'This page is no longer available.',
      },
      411: {
        statusCode: 411,
        errorCode: 'ERR_DELTA_1711',
        message:
          'We couldn’t process your request. Please refresh and try again.',
      },
      412: {
        statusCode: HttpStatus.PRECONDITION_FAILED,
        errorCode: 'ERR_DELTA_1712',
        message: 'This data has changed. Please refresh and try again.',
      },
      413: {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        errorCode: 'ERR_DELTA_1713',
        message: 'Request is too large!',
      },
      414: {
        statusCode: HttpStatus.URI_TOO_LONG,
        errorCode: 'ERR_DELTA_1714',
        message: 'The request was too long. Please try again.',
      },
      415: {
        statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        errorCode: 'ERR_DELTA_1715',
        message: 'File format is not supported.',
      },
      416: {
        statusCode: HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
        errorCode: 'ERR_DELTA_1716',
        message: 'Issue loading part of the file. Please refresh.',
      },
      417: {
        statusCode: HttpStatus.EXPECTATION_FAILED,
        errorCode: 'ERR_DELTA_1717',
        message: 'Something went wrong. Please contact support.',
      },
      418: {
        statusCode: 418,
        errorCode: 'ERR_DELTA_1718',
        message: 'This feature isn’t available right now.',
      },
      421: {
        statusCode: 421,
        errorCode: 'ERR_DELTA_1721',
        message:
          'We couldn’t connect you to the right server. Please try again.',
      },
      422: {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        errorCode: 'ERR_DELTA_1722',
        message:
          'Some information you entered is invalid. Please check and try again.',
      },
      423: {
        statusCode: 423,
        errorCode: 'ERR_DELTA_1723',
        message: 'This resource is locked and cannot be modified right now.',
      },
      424: {
        statusCode: 424,
        errorCode: 'ERR_DELTA_1724',
        message: 'A related operation failed. Please try again later.',
      },
      425: {
        statusCode: 425,
        errorCode: 'ERR_DELTA_1725',
        message: 'There was a connection issue. Please try again.',
      },
      426: {
        statusCode: 426,
        errorCode: 'ERR_DELTA_1726',
        message: 'Please use a secure connection (HTTPS).',
      },
      428: {
        statusCode: 428,
        errorCode: 'ERR_DELTA_1728',
        message: 'Please refresh to ensure you’re editing the latest version.',
      },
      429: {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        errorCode: 'ERR_DELTA_1729',
        message: 'Too many requests. Please try again later.',
      },
      431: {
        statusCode: 431,
        errorCode: 'ERR_DELTA_1731',
        message:
          'Something went wrong with your request. Please clear cookies and try again.',
      },
      451: {
        statusCode: 451,
        errorCode: 'ERR_DELTA_1751',
        message:
          'This content is not available in your region due to legal restrictions.',
      },

      // 5xx Server Errors
      500: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: 'ERR_DELTA_1800',
        message: 'An internal server error occurred. Please try again later.',
      },
      501: {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        errorCode: 'ERR_DELTA_1801',
        message: 'This feature is not implemented yet.',
      },
      502: {
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'ERR_DELTA_1802',
        message: 'Received an invalid response from an upstream server.',
      },
      503: {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'ERR_DELTA_1803',
        message:
          'The service is temporarily unavailable. Please try again later.',
      },
      504: {
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        errorCode: 'ERR_DELTA_1804',
        message: 'Gateway timeout. The server did not respond in time.',
      },
      505: {
        statusCode: HttpStatus.HTTP_VERSION_NOT_SUPPORTED,
        errorCode: 'ERR_DELTA_1805',
        message: 'HTTP version not supported by the server.',
      },
      506: {
        statusCode: 506,
        errorCode: 'ERR_DELTA_1806',
        message:
          'Variant also negotiates. The server configuration is invalid.',
      },
      507: {
        statusCode: 507,
        errorCode: 'ERR_DELTA_1807',
        message: 'Insufficient storage to complete the request.',
      },
      508: {
        statusCode: 508,
        errorCode: 'ERR_DELTA_1808',
        message: 'Infinite loop detected. Please contact support.',
      },
      510: {
        statusCode: 510,
        errorCode: 'ERR_DELTA_1810',
        message: 'Further extensions are required to fulfill the request.',
      },
      511: {
        statusCode: 511,
        errorCode: 'ERR_DELTA_1811',
        message:
          'Network authentication required. Please check your connection.',
      },
    };

    const err = errorMap[statusCode];
    const now = new Date().toISOString();
    if (err) {
      Logger.error(
        `[ErrorService] ${statusCode} - ${err.errorCode} - ${errorData?.message}`,
      );

      throw new AppException(
        errorData?.message || err.message, // Use custom message if provided
        err.statusCode,
        err.errorCode,
        errorData?.details,
        errorData?.request?.id,
      );
    }

    // fallback for unknown status codes
    const fallbackBody = HttpException.createBody({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'ERR_DELTA_UNKNOWN',
      message: errorData?.message || 'An unexpected error occurred.',
      timestamp: now,
      requestId: errorData?.request?.id,
    });

    Logger.error(`[ErrorService] Unknown status code: ${statusCode}`);

    throw new HttpException(fallbackBody, HttpStatus.INTERNAL_SERVER_ERROR, {
      description: 'Unknown error',
    });
  }
}
