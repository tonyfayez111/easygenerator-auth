import { Box, Progress, Stack, Text } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

const requirements = [
  { regex: /.{8,}/, label: 'At least 8 characters' },
  { regex: /[a-zA-Z]/, label: 'Contains a letter' },
  { regex: /[0-9]/, label: 'Contains a number' },
  { regex: /[^a-zA-Z0-9]/, label: 'Contains a special character' },
];

function getStrength(password: string): number {
  return requirements.filter((r) => r.regex.test(password)).length;
}

function strengthColor(score: number): string {
  if (score === 0) return 'gray';
  if (score === 1) return 'red';
  if (score === 2) return 'orange';
  if (score === 3) return 'yellow';
  return 'green';
}

function strengthLabel(score: number): string {
  if (score === 0) return '';
  if (score === 1) return 'Weak';
  if (score === 2) return 'Fair';
  if (score === 3) return 'Good';
  return 'Strong';
}

interface Props {
  password: string;
}

export function PasswordStrengthMeter({ password }: Props) {
  const score = getStrength(password);
  const color = strengthColor(score);
  const label = strengthLabel(score);

  return (
    <Box mt={4}>
      <Progress
        value={(score / requirements.length) * 100}
        color={color}
        size="xs"
        mb={6}
      />
      {label && (
        <Text size="xs" c={color} fw={500} mb={4}>
          {label}
        </Text>
      )}
      <Stack gap={2}>
        {requirements.map(({ regex, label: reqLabel }) => {
          const met = regex.test(password);
          return (
            <Text
              key={reqLabel}
              size="xs"
              c={met ? 'green' : 'dimmed'}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {met ? <IconCheck size={12} /> : <IconX size={12} />}
              {reqLabel}
            </Text>
          );
        })}
      </Stack>
    </Box>
  );
}
