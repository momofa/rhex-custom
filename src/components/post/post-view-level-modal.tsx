"use client"

import { useState } from "react"

import { AccessThresholdSelectGroup } from "@/components/access-threshold-select-group"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"

interface PostViewLevelModalProps {
  open: boolean
  value: {
    minViewLevel: string
    minViewVipLevel: string
  }
  levelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  onChange: (value: { minViewLevel: string; minViewVipLevel: string }) => void
  onClose: () => void
}

export function PostViewLevelModal({ open, value, levelOptions, vipLevelOptions, onChange, onClose }: PostViewLevelModalProps) {
  return (
    <PostViewLevelModalBody
      key={open ? "open" : "closed"}
      open={open}
      initialValue={value}
      levelOptions={levelOptions}
      vipLevelOptions={vipLevelOptions}
      onChange={onChange}
      onClose={onClose}
    />
  )
}

function PostViewLevelModalBody({ open, initialValue, levelOptions, vipLevelOptions, onChange, onClose }: {
  open: boolean
  initialValue: { minViewLevel: string; minViewVipLevel: string }
  levelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  onChange: (value: { minViewLevel: string; minViewVipLevel: string }) => void
  onClose: () => void
}) {
  const [draftLevelValue, setDraftLevelValue] = useState(initialValue.minViewLevel)
  const [draftVipLevelValue, setDraftVipLevelValue] = useState(initialValue.minViewVipLevel)

  function handleSave() {
    onChange({
      minViewLevel: draftLevelValue,
      minViewVipLevel: draftVipLevelValue,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="设置整帖浏览门槛"
      description="这里控制整篇帖子的正文访问。"
      footer={(
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
          <Button type="button" onClick={handleSave}>保存访问门槛</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <AccessThresholdSelectGroup
          levelValue={draftLevelValue}
          vipLevelValue={draftVipLevelValue}
          levelOptions={levelOptions}
          vipLevelOptions={vipLevelOptions}
          onLevelChange={setDraftLevelValue}
          onVipLevelChange={setDraftVipLevelValue}
        />
      </div>
    </Modal>
  )
}

