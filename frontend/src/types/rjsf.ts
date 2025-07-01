import { ComponentType } from 'react'
import { JSONSchema7 } from 'json-schema'

// RJSF Core Types
export interface RJSFSchema extends JSONSchema7 {
  // No UI properties in schema - they go in UI schema
}

export interface RJSFUISchema {
  [key: string]: {
    'ui:widget'?: string | ComponentType<any>
    'ui:field'?: string | ComponentType<any>
    'ui:options'?: Record<string, any>
    'ui:order'?: string[]
    'ui:title'?: string
    'ui:description'?: string
    'ui:help'?: string
    'ui:placeholder'?: string
    'ui:classNames'?: string
    'ui:style'?: Record<string, any>
    'ui:hidden'?: boolean
    'ui:disabled'?: boolean
    'ui:readonly'?: boolean
    'ui:autofocus'?: boolean
    'ui:autocomplete'?: string
    'ui:emptyValue'?: any
    'ui:enumDisabled'?: string[]
  } | RJSFUISchema
}

export interface RJSFFormData {
  [key: string]: any
}

export interface RJSFFormProps {
  schema: RJSFSchema
  uiSchema?: RJSFUISchema
  formData?: RJSFFormData
  onChange?: (data: { formData: RJSFFormData }) => void
  onSubmit?: (data: { formData: RJSFFormData }, event: React.FormEvent) => void
  onError?: (errors: RJSFError[]) => void
  onFocus?: (id: string, value: any) => void
  onBlur?: (id: string, value: any) => void
  disabled?: boolean
  readonly?: boolean
  showErrorList?: boolean
  noValidate?: boolean
  noHtml5Validate?: boolean
  liveValidate?: boolean
  validate?: (formData: RJSFFormData, errors: RJSFError[]) => RJSFError[]
  fields?: Record<string, ComponentType<any>>
  widgets?: Record<string, ComponentType<any>>
  ArrayFieldTemplate?: ComponentType<any>
  ObjectFieldTemplate?: ComponentType<any>
  FieldTemplate?: ComponentType<any>
  ErrorListTemplate?: ComponentType<any>
  formContext?: Record<string, any>
  customFormats?: Record<string, (value: any) => boolean>
  transformErrors?: (errors: RJSFError[]) => RJSFError[]
  className?: string
  children?: React.ReactNode
}

export interface RJSFError {
  name: string
  property: string
  message: string
  stack: string
  schemaPath: string
}

export interface RJSFFieldProps {
  schema: RJSFSchema
  uiSchema: RJSFUISchema
  idSchema: Record<string, any>
  formData: any
  errorSchema: Record<string, any>
  onChange: (value: any) => void
  onBlur: (id: string, value: any) => void
  onFocus: (id: string, value: any) => void
  registry: RJSFRegistry
  disabled?: boolean
  readonly?: boolean
  autofocus?: boolean
  rawErrors?: string[]
}

export interface RJSFWidgetProps {
  id: string
  schema: RJSFSchema
  value: any
  required: boolean
  disabled?: boolean
  readonly?: boolean
  autofocus?: boolean
  placeholder?: string
  onChange: (value: any) => void
  onBlur: (id: string, value: any) => void
  onFocus: (id: string, value: any) => void
  options: Record<string, any>
  formContext: Record<string, any>
  label?: string
  multiple?: boolean
  rawErrors?: string[]
}

export interface RJSFRegistry {
  fields: Record<string, ComponentType<RJSFFieldProps>>
  widgets: Record<string, ComponentType<RJSFWidgetProps>>
  definitions: Record<string, RJSFSchema>
  formContext: Record<string, any>
}

// Custom Widget Types for BBOS
export interface BBOSBoardSelectorProps {
  value?: string
  onChange: (board: string) => void
  schema: RJSFSchema
  disabled?: boolean
  readonly?: boolean
}

export interface BBOSDistributionSelectorProps {
  value?: { release: string; type: string; desktop?: string }
  onChange: (distribution: any) => void
  schema: RJSFSchema
  disabled?: boolean
  readonly?: boolean
}

export interface BBOSPackageManagerProps {
  value?: { install?: string[]; remove?: string[]; sources?: any[] }
  onChange: (packages: any) => void
  schema: RJSFSchema
  disabled?: boolean
  readonly?: boolean
}

export interface BBOSScriptEditorProps {
  value?: string
  onChange: (script: string) => void
  language?: 'bash' | 'yaml' | 'json'
  schema: RJSFSchema
  disabled?: boolean
  readonly?: boolean
}

export interface BBOSFileUploaderProps {
  value?: File[]
  onChange: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSize?: number
  schema: RJSFSchema
  disabled?: boolean
  readonly?: boolean
}

// Schema Generation Types
export interface SchemaField {
  name: string
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  title?: string
  description?: string
  default?: any
  enum?: any[]
  enumNames?: string[]
  format?: string
  pattern?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  required?: boolean
  properties?: Record<string, SchemaField>
  items?: SchemaField
  additionalProperties?: boolean | SchemaField
  widget?: string
  options?: Record<string, any>
}

export interface SchemaGenerator {
  generateSchema(fields: SchemaField[]): RJSFSchema
  generateUISchema(fields: SchemaField[]): RJSFUISchema
  addCustomWidget(name: string, widget: ComponentType<RJSFWidgetProps>): void
  addCustomField(name: string, field: ComponentType<RJSFFieldProps>): void
}

// Form Builder Types
export interface FormBuilder {
  schema: RJSFSchema
  uiSchema: RJSFUISchema
  addField(field: SchemaField): void
  removeField(fieldName: string): void
  updateField(fieldName: string, updates: Partial<SchemaField>): void
  reorderFields(fieldNames: string[]): void
  validateSchema(): RJSFError[]
  exportSchema(): { schema: RJSFSchema; uiSchema: RJSFUISchema }
  importSchema(schema: RJSFSchema, uiSchema?: RJSFUISchema): void
}

// Validation Types
export interface ValidationRule {
  type: 'required' | 'pattern' | 'range' | 'length' | 'custom'
  message: string
  params?: Record<string, any>
  validator?: (value: any, formData: RJSFFormData) => boolean
}

export interface FieldValidation {
  fieldName: string
  rules: ValidationRule[]
}

export interface FormValidation {
  fields: FieldValidation[]
  customValidators: Record<string, (formData: RJSFFormData) => RJSFError[]>
}

// Theme Types
export interface RJSFTheme {
  name: string
  fields: Record<string, ComponentType<RJSFFieldProps>>
  widgets: Record<string, ComponentType<RJSFWidgetProps>>
  templates: {
    ArrayFieldTemplate?: ComponentType<any>
    ObjectFieldTemplate?: ComponentType<any>
    FieldTemplate?: ComponentType<any>
    ErrorListTemplate?: ComponentType<any>
  }
  className?: string
  styles?: Record<string, any>
}

// BBOS Custom Themes
export interface BBOSThemes {
  default: RJSFTheme
  vscode: RJSFTheme
  antd: RJSFTheme
  material: RJSFTheme
}

// Advanced Types
export interface ConditionalField {
  fieldName: string
  condition: (formData: RJSFFormData) => boolean
  schema: RJSFSchema
  uiSchema?: RJSFUISchema
}

export interface DynamicSchema {
  baseSchema: RJSFSchema
  baseUISchema: RJSFUISchema
  conditionalFields: ConditionalField[]
  computedFields: Record<string, (formData: RJSFFormData) => any>
  dependencies: Record<string, string[]>
}

export interface FormContext extends Record<string, any> {
  user?: any
  configuration?: any
  buildJob?: any
  theme?: string
  locale?: string
  timezone?: string
}

// Event Types
export interface FormEvent {
  type: 'change' | 'submit' | 'error' | 'focus' | 'blur' | 'validate'
  fieldName?: string
  value?: any
  formData?: RJSFFormData
  errors?: RJSFError[]
  timestamp: string
}

export interface FormEventHandler {
  (event: FormEvent): void
} 