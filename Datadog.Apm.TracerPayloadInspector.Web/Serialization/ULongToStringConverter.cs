using System.Text.Json;
using System.Text.Json.Serialization;

namespace Datadog.Apm.TracerPayloadInspector.Web.Serialization;

/// <summary>
/// Converts ulong values to strings in JSON to prevent JavaScript precision loss.
/// JavaScript's Number.MAX_SAFE_INTEGER is 2^53-1, but ulong can hold values up to 2^64-1.
/// </summary>
public class ULongToStringConverter : JsonConverter<ulong>
{
    public override ulong Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String)
        {
            var stringValue = reader.GetString();
            if (ulong.TryParse(stringValue, out var value))
            {
                return value;
            }
        }
        else if (reader.TokenType == JsonTokenType.Number)
        {
            return reader.GetUInt64();
        }

        throw new JsonException($"Unable to convert \"{reader.GetString()}\" to ulong.");
    }

    public override void Write(Utf8JsonWriter writer, ulong value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString());
    }
}

/// <summary>
/// Converts nullable ulong values to strings in JSON to prevent JavaScript precision loss.
/// </summary>
public class NullableULongToStringConverter : JsonConverter<ulong?>
{
    public override ulong? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            return null;
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            var stringValue = reader.GetString();
            if (string.IsNullOrEmpty(stringValue))
            {
                return null;
            }
            if (ulong.TryParse(stringValue, out var value))
            {
                return value;
            }
        }
        else if (reader.TokenType == JsonTokenType.Number)
        {
            return reader.GetUInt64();
        }

        throw new JsonException($"Unable to convert \"{reader.GetString()}\" to nullable ulong.");
    }

    public override void Write(Utf8JsonWriter writer, ulong? value, JsonSerializerOptions options)
    {
        if (value.HasValue)
        {
            writer.WriteStringValue(value.Value.ToString());
        }
        else
        {
            writer.WriteNullValue();
        }
    }
}
