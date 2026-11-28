// WS11 (трек B): Next.js викликає onRequestError на кожну необроблену помилку сервера (сторінка, Route Handler,
// Server Action, proxy). Пересилаємо лише шаблон маршруту, тип, метод і помилку — request.headers не чіпаємо
// (там cookie сесії). Що саме йде в чат — src/lib/ops/error-alert.ts.
import type { Instrumentation } from "next";
import { sendErrorAlert } from "@/lib/ops/error-alert";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await sendErrorAlert(error, {
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
  });
};
