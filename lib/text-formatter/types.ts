export type FormatterLocale = "pt-BR" | "en";

export type Localized<T> = Readonly<Record<FormatterLocale, T>>;

export type ParamValue =
  | string
  | number
  | boolean
  | null
  | readonly ParamValue[]
  | { readonly [key: string]: ParamValue };

export type ParamRecord = Readonly<Record<string, ParamValue>>;

export type OperationGroup =
  | "spacing"
  | "lines"
  | "words"
  | "substrings"
  | "characters"
  | "capitalization"
  | "minification"
  | "cleanup"
  | "other";

export type FieldDefinition =
  | {
      readonly type: "text";
      readonly key: string;
      readonly label: Localized<string>;
      readonly placeholder?: Localized<string>;
      readonly multiline?: boolean;
      readonly required?: boolean;
    }
  | {
      readonly type: "number";
      readonly key: string;
      readonly label: Localized<string>;
      readonly min?: number;
      readonly max?: number;
      readonly step?: number;
    }
  | {
      readonly type: "toggle";
      readonly key: string;
      readonly label: Localized<string>;
    }
  | {
      readonly type: "select";
      readonly key: string;
      readonly label: Localized<string>;
      readonly options: readonly {
        readonly value: string;
        readonly label: Localized<string>;
      }[];
    };

export type FormatterIssueCode =
  | "required"
  | "invalid-value"
  | "invalid-regex"
  | "unsupported-regex-flag"
  | "duplicate-regex-flag"
  | "regex-timeout"
  | "too-many-matches"
  | "output-too-large"
  | "operation-failed";

export interface FormatterIssue {
  readonly code: FormatterIssueCode;
  readonly severity: "warning" | "error";
  readonly field?: string;
  readonly values?: Readonly<Record<string, string | number>>;
  readonly detail?: string;
}

export type FormatterAnalysis =
  | {
      readonly kind: "match-count";
      readonly count: number;
      readonly truncated: boolean;
    }
  | {
      readonly kind: "word-frequency";
      readonly total: number;
      readonly unique: number;
      readonly rows: readonly {
        readonly word: string;
        readonly count: number;
        readonly percentage: number;
      }[];
    };

export interface TransformResult {
  readonly text: string;
  readonly issues?: readonly FormatterIssue[];
  readonly analysis?: readonly FormatterAnalysis[];
}

export interface TransformContext {
  readonly locale: FormatterLocale;
  readonly maxMatches: number;
  readonly maxOutputCharacters: number;
  readonly signal: AbortSignal;
}

export interface OperationDefinition<P extends ParamRecord = ParamRecord> {
  readonly id: string;
  readonly group: OperationGroup;
  readonly label: Localized<string>;
  readonly description: Localized<string>;
  readonly keywords: Localized<readonly string[]>;
  readonly defaults: P;
  readonly fields: readonly FieldDefinition[];
  readonly validate: (params: P) => readonly FormatterIssue[];
  readonly transform: (
    input: string,
    params: P,
    context: TransformContext,
  ) => TransformResult | Promise<TransformResult>;
}

export interface RegisteredOperation
  extends Omit<OperationDefinition<ParamRecord>, "transform" | "validate"> {
  readonly validate: (params: ParamRecord) => readonly FormatterIssue[];
  readonly transform: (
    input: string,
    params: ParamRecord,
    context: TransformContext,
  ) => TransformResult | Promise<TransformResult>;
}

export interface OperationInstance {
  readonly instanceId: string;
  readonly operationId: string;
  readonly enabled: boolean;
  readonly params: ParamRecord;
}

export interface OperationExecution {
  readonly instanceId: string;
  readonly status: "disabled" | "success" | "warning" | "error";
  readonly inputCharacters: number;
  readonly outputCharacters: number;
  readonly issues: readonly FormatterIssue[];
  readonly analysis: readonly FormatterAnalysis[];
}

export interface PipelineResult {
  readonly text: string;
  readonly executions: readonly OperationExecution[];
}

export interface TextStats {
  readonly characters: number;
  readonly words: number;
  readonly lines: number;
  readonly bytes: number;
  readonly formattedBytes: string;
}

export interface FormatterPreset {
  readonly id: string;
  readonly label: Localized<string>;
  readonly operations: readonly {
    readonly operationId: string;
    readonly params: ParamRecord;
  }[];
}

export interface TextSearchOptions {
  readonly caseSensitive?: boolean;
  readonly wholeWord?: boolean;
  readonly regex?: boolean;
  readonly flags?: string;
  readonly maxMatches?: number;
}

export interface TextMatch {
  readonly start: number;
  readonly end: number;
}

export interface TextSearchResult {
  readonly matches: readonly TextMatch[];
  readonly total: number;
  readonly truncated: boolean;
  readonly issue?: FormatterIssue;
}

export interface TextReplaceResult extends TextSearchResult {
  readonly text: string;
  readonly replacements: number;
}
