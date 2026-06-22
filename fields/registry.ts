import { Field } from "@/types/field";
import { z } from "zod";
import * as booleanField from "@/fields/core/boolean";
import * as codeField from "@/fields/core/code";
import * as dateField from "@/fields/core/date";
import * as fileField from "@/fields/core/file";
import * as imageField from "@/fields/core/image";
import * as numberField from "@/fields/core/number";
import * as referenceField from "@/fields/core/reference";
import * as richTextField from "@/fields/core/rich-text";
import * as selectField from "@/fields/core/select";
import * as stringField from "@/fields/core/string";
import * as textField from "@/fields/core/text";
import * as uuidField from "@/fields/core/uuid";

export type FieldCodec = {
  label?: string;
  schema?: (...args: any[]) => z.ZodTypeAny;
  defaultValue?: any;
  read?: (...args: any[]) => any;
  write?: (...args: any[]) => any;
  EditComponent?: React.ComponentType<any>;
  ViewComponent?: React.ComponentType<any>;
};

const codecMap = new Map<string, FieldCodec>();

const registerField = (fieldName: string, fieldModule: FieldCodec) => {
  codecMap.set(fieldName, fieldModule);
};

registerField("boolean", booleanField);
registerField("code", codeField);
registerField("date", dateField);
registerField("file", fileField);
registerField("image", imageField);
registerField("number", numberField);
registerField("reference", referenceField);
registerField("rich-text", richTextField);
registerField("select", selectField);
registerField("string", stringField);
registerField("text", textField);
registerField("uuid", uuidField);

export const getCodec = (type: string): FieldCodec | undefined => codecMap.get(type);
