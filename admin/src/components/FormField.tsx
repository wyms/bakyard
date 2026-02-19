import { useState } from 'react';
import { X } from 'lucide-react';

interface BaseFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
}

interface TextFieldProps extends BaseFieldProps {
  type: 'text' | 'number' | 'email' | 'password' | 'datetime-local' | 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
}

interface TextAreaFieldProps extends BaseFieldProps {
  type: 'textarea';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

interface SelectFieldProps extends BaseFieldProps {
  type: 'select';
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

interface CheckboxFieldProps extends BaseFieldProps {
  type: 'checkbox';
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface MultiselectFieldProps extends BaseFieldProps {
  type: 'multiselect';
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

type FormFieldProps =
  | TextFieldProps
  | TextAreaFieldProps
  | SelectFieldProps
  | CheckboxFieldProps
  | MultiselectFieldProps;

export default function FormField(props: FormFieldProps) {
  const { label, error, required, className = '' } = props;

  if (props.type === 'checkbox') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-teal focus:ring-teal"
        />
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (props.type === 'multiselect') {
    return <MultiselectField {...props} />;
  }

  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-coral">*</span>}
      </label>

      {props.type === 'textarea' ? (
        <textarea
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows || 3}
          className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 ${
            error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
          }`}
        />
      ) : props.type === 'select' ? (
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 ${
            error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
          }`}
        >
          {props.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={props.type}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          min={props.min}
          max={props.max}
          step={props.step}
          className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 ${
            error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
          }`}
        />
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function MultiselectField({
  label,
  values,
  onChange,
  placeholder,
  error,
  required,
  className = '',
}: MultiselectFieldProps) {
  const [inputValue, setInputValue] = useState('');

  function addTag() {
    const tag = inputValue.trim().toLowerCase();
    if (tag && !values.includes(tag)) {
      onChange([...values, tag]);
    }
    setInputValue('');
  }

  function removeTag(tag: string) {
    onChange(values.filter((v) => v !== tag));
  }

  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-coral">*</span>}
      </label>
      <div
        className={`flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
        }`}
      >
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-teal/60 hover:text-teal"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder={values.length === 0 ? placeholder : ''}
          className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
