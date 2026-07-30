import { useState } from "react";
import { Button, Card, Group, Stack, Text, TextInput, Title } from "@mantine/core";

function WorkflowBuilder({ steps = [], onChange }) {
  const [newStep, setNewStep] = useState("");

  function addStep() {
    if (!newStep.trim()) return;
    onChange([...steps, newStep.trim()]);
    setNewStep("");
  }

  function removeStep(indexToRemove) {
    onChange(steps.filter((_, index) => index !== indexToRemove));
  }

  return (
    <Stack>
      <Title order={4}>Production Workflow</Title>

      {steps.map((step, index) => (
        <Card key={`${step}-${index}`} withBorder radius="md" p="sm">
          <Group justify="space-between">
            <Text fw={700}>
              {index + 1}. {step}
            </Text>

            <Button
              size="xs"
              variant="light"
              color="red"
              onClick={() => removeStep(index)}
            >
              Remove
            </Button>
          </Group>
        </Card>
      ))}

      <Group>
        <TextInput
          placeholder="Add workflow step..."
          value={newStep}
          onChange={(event) => setNewStep(event.currentTarget.value)}
          style={{ flex: 1 }}
        />

        <Button color="red" onClick={addStep}>
          Add Step
        </Button>
      </Group>
    </Stack>
  );
}

export default WorkflowBuilder;