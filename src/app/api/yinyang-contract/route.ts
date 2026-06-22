import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requirePositiveIntegerField, requireStringField } from "@/lib/api-route"
import { acceptYinYangChallenge, createYinYangChallenge, getYinYangLobbyData } from "@/lib/yinyang-contract"

export const GET = createUserRouteHandler(async ({ currentUser }) => {
  const data = await getYinYangLobbyData(currentUser)
  return apiSuccess(data)
}, {
  errorMessage: "阴阳契数据加载失败",
  logPrefix: "[api/yinyang-contract:GET] unexpected error",
  unauthorizedMessage: "请先登录后查看阴阳契",
})

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const action = requireStringField(body, "action", "不支持的操作")

  if (action === "create") {
    const question = requireStringField(body, "question", "请输入问题")
    const optionA = requireStringField(body, "optionA", "请输入答案A")
    const optionB = requireStringField(body, "optionB", "请输入答案B")
    const correctOption = requireStringField(body, "correctOption", "请选择正确答案")
    const stakePoints = requirePositiveIntegerField(body, "stakePoints", "请输入正确的积分彩头")
    const data = await createYinYangChallenge(currentUser, {
      question,
      optionA,
      optionB,
      correctOption: correctOption === "A" || correctOption === "B" ? correctOption : apiError(400, "正确答案不合法"),
      stakePoints,
    })
    return apiSuccess(data, "挑战已创建")
  }

  if (action === "accept") {
    const challengeId = requireStringField(body, "challengeId", "缺少挑战参数")
    const selectedOption = requireStringField(body, "selectedOption", "请选择答案")
    const data = await acceptYinYangChallenge(currentUser, {
      challengeId,
      selectedOption: selectedOption === "A" || selectedOption === "B" ? selectedOption : apiError(400, "答案不合法"),
    })
    return apiSuccess(data, "挑战已完成结算")
  }

  apiError(400, "不支持的操作")

}, {
  errorMessage: "阴阳契操作失败",
  logPrefix: "[api/yinyang-contract:POST] unexpected error",
  unauthorizedMessage: "请先登录后参与阴阳契",
})
