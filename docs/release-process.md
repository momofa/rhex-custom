# GitHub 发布与 Docker 镜像流程

本文档是 Rhex Plus 的固定正式发布流程。以后每次发布都按本文执行。

## 固定规则

- 正式发布统一推送到 GitHub `main` 分支。
- Docker 镜像统一由 `.github/workflows/publish-image.yml` 中的 `Publish Docker Image` 构建并推送。
- 每次正式发布必须同时生成：
  - `ghcr.io/momofa/rhex-custom:latest`
  - `ghcr.io/momofa/rhex-custom:sha-<短提交号>`
- 生产镜像平台必须包含 `linux/amd64`。
- `sha-*` 是不可变版本，用于追溯和回滚；`latest` 始终指向 `main` 的最新成功构建。
- Apple Silicon 本机不使用普通的 `docker build` 构建并推送生产镜像。

## 1. 更新版本号

发布前更新 `package.json` 中的日期版本号，例如：

```json
{
  "version": "20260716"
}
```

页面中对应显示为 `Rhex Plus 20260716`。

## 2. 本地校验

先检查工作区，区分本次发布内容和其他未完成修改：

```bash
git status --short
git diff --check
git diff --stat
git diff
```

执行首选的 TypeScript 校验：

```bash
./node_modules/.bin/tsc --noEmit --pretty false
```

`pnpm lint` 可能受 lockfile 或本地配置影响。如果它失败，需要先判断是否与本次修改有关，不能直接视为本次发布失败。

## 3. 精确提交本次文件

只暂存本次明确修改的文件：

```bash
git add package.json src/path/to/changed-file.tsx
git status --short
```

不要使用 `git add -A`。特别注意不要误提交无关内容，例如 `next-env.d.ts`、`plugin-workspace/` 和 `tools/`。

使用英文 Conventional Commit 信息：

```bash
git commit -m "feat: prepare 20260716 release"
```

记录完整提交号和七位短提交号：

```bash
git rev-parse HEAD
git rev-parse --short=7 HEAD
```

## 4. 推送 GitHub main

```bash
git push origin HEAD:main
```

推送成功的输出应包含 `HEAD -> main`。如果当前分支就是 `main`，`git push origin main` 与上述命令等效。

`gh` 不是发布的必要条件。即使没有安装 `gh`，只要 Git 凭据可用，仍可通过 `git push` 完成正式发布。

## 5. 确认 GitHub Actions 成功

推送后打开 [Publish Docker Image](https://github.com/momofa/rhex-custom/actions/workflows/publish-image.yml)，确认：

1. 工作流对应的提交号与刚推送的提交一致。
2. `Build and push image` 步骤成功。
3. 整个工作流状态为 `Success`。
4. GHCR 同时存在 `latest` 和本次提交对应的 `sha-*` 标签。

例如提交短号为 `f6c7471`，应生成：

```txt
ghcr.io/momofa/rhex-custom:latest
ghcr.io/momofa/rhex-custom:sha-f6c7471
```

Actions 未成功前，不进入生产部署步骤。推送 GitHub 成功不等于镜像发布成功。

## 6. 验证镜像平台

```bash
docker buildx imagetools inspect ghcr.io/momofa/rhex-custom:latest
docker buildx imagetools inspect ghcr.io/momofa/rhex-custom:sha-<短提交号>
```

运行镜像的 manifest 必须包含：

```txt
Platform: linux/amd64
```

`Platform: unknown/unknown` 通常是 buildx 的 attestation manifest，不是运行镜像本体，可以忽略。

## 7. 生产服务器更新

Actions 成功后，进入生产服务器的实际部署目录执行：

```bash
docker compose pull
docker compose up -d
docker compose ps
```

随后至少确认：

- 容器已使用新镜像启动。
- 首页和登录相关页面正常访问。
- 页面显示的 `Rhex Plus` 版本号正确。
- 本次修改涉及的核心功能正常。

具体部署目录、Compose 服务名和健康检查命令以生产环境配置为准。

## 8. 回滚

不要依赖会移动的 `latest` 标签回滚。将生产配置指向上一个可用的不可变标签：

```txt
ghcr.io/momofa/rhex-custom:sha-<上一个短提交号>
```

然后重新执行：

```bash
docker compose pull
docker compose up -d
docker compose ps
```

恢复后记录失败版本、回滚标签和原因，再修复并重新走完整发布流程。

## 9. 网络或 gh 不可用

- `gh` 安装不是必需步骤，优先使用现有 Git 凭据执行 `git push origin HEAD:main`。
- GitHub 页面暂时不可用时，等待网络恢复后再确认 Actions，不能跳过构建结果确认。
- 工作流失败时，先检查日志并修复，再重新推送或手动重跑。
- 不要因为 `brew`、`gh` 或网络暂时缓慢，就把本机构建改成日常发布方式。

## 10. 紧急本地构建（仅兜底）

只有 GitHub Actions 确实不可用且生产发布不能等待时，才允许使用：

```bash
docker buildx build --platform linux/amd64 -t ghcr.io/momofa/rhex-custom:latest --push .
docker buildx imagetools inspect ghcr.io/momofa/rhex-custom:latest
```

紧急方案不能替代日常流程。恢复后仍应补齐 GitHub 提交、不可变 `sha-*` 标签和发布记录。

## 每次发布检查清单

- [ ] 已更新并确认 `package.json` 版本号。
- [ ] 已执行 `git status --short` 和 `git diff --check`。
- [ ] 已通过 `tsc`，或记录了与本次修改无关的既有问题。
- [ ] 只暂存了本次发布文件。
- [ ] 已使用英文 Conventional Commit 提交。
- [ ] 已执行 `git push origin HEAD:main`。
- [ ] `Publish Docker Image` 对应正确提交且执行成功。
- [ ] `latest` 和 `sha-*` 两个镜像标签均已生成。
- [ ] 镜像运行平台包含 `linux/amd64`。
- [ ] 生产服务器已拉取镜像并重启。
- [ ] 已完成版本号、页面和核心功能验证。
