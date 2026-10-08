/* eslint-disable react-refresh/only-export-components -- this module exports a shared UI hook */
import { useState } from "react";
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEye, IconEyeOff, IconLock } from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import {
  canUnlockProjectMoney,
  isProjectMoneyUnlocked,
  setProjectMoneyActiveUser,
  setProjectMoneyUnlocked,
} from "../lib/projectMoneyPrivacy";

export function useProjectMoneyPrivacy(activeUser) {
  setProjectMoneyActiveUser(activeUser);
  const [unlocked, setUnlocked] = useState(() => isProjectMoneyUnlocked(activeUser));
  const [modalOpen, setModalOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const allowed = canUnlockProjectMoney(activeUser);

  function requestUnlock() {
    if (allowed) setModalOpen(true);
  }

  function lock() {
    setProjectMoneyUnlocked(activeUser, false);
    setUnlocked(false);
  }

  async function verify() {
    setChecking(true);
    const { data, error } = await supabase.rpc("verify_project_financial_pin", { p_pin: pin });
    setChecking(false);
    if (error || data !== true) {
      notifications.show({ title: "Money Remains Hidden", message: error?.message || "The PIN was not accepted for this employee.", color: "red" });
      setPin("");
      return;
    }
    setProjectMoneyUnlocked(activeUser, true);
    setUnlocked(true);
    setPin("");
    setModalOpen(false);
    notifications.show({ title: "Project Money Unlocked", message: "Financial values will remain visible until you lock them or sign out.", color: "green" });
  }

  const controls = (
    <>
      <Alert color={unlocked ? "green" : "gray"} variant="light" icon={unlocked ? <IconEye size={20} /> : <IconLock size={20} />}>
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <Text fw={850}>{unlocked ? "Project money is visible" : "Project money is hidden"}</Text>
            <Text size="sm" c="dimmed">{allowed ? "Authorized employees can unlock values with the financial PIN." : "Your employee profile does not have project-financial access."}</Text>
          </div>
          {allowed && (unlocked
            ? <Button variant="light" color="gray" leftSection={<IconEyeOff size={16} />} onClick={lock}>Hide Money</Button>
            : <Button color="red" leftSection={<IconEye size={16} />} onClick={requestUnlock}>Unlock Money</Button>)}
        </Group>
      </Alert>
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Unlock Project Money" centered>
        <Stack>
          <Text size="sm">Enter the four-digit project financial PIN.</Text>
          <PasswordInput label="Financial PIN" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.currentTarget.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(event) => { if (event.key === "Enter" && pin.length === 4) verify(); }} autoFocus />
          <Group justify="flex-end"><Button variant="light" color="gray" onClick={() => setModalOpen(false)}>Cancel</Button><Button color="red" loading={checking} disabled={pin.length !== 4} onClick={verify}>Unlock</Button></Group>
        </Stack>
      </Modal>
    </>
  );

  return { allowed, unlocked, requestUnlock, lock, controls };
}

export default function ProjectMoneyPrivacy({ activeUser }) {
  return useProjectMoneyPrivacy(activeUser).controls;
}
