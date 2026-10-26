import type { FieldIssues } from '@/lib/calc/issues';
import type { CalcForm, FormUnits } from '@/lib/calc/types';

export interface GroupProps {
  readonly form: CalcForm;
  readonly set: <K extends keyof CalcForm>(key: K, value: CalcForm[K]) => void;
  readonly setUnits: (next: Partial<FormUnits>) => void;
  readonly issues: FieldIssues;
}
