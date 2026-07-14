-- Llama una vez al endpoint /scp/previsiones vía WinHTTP (OLE Automation)
CREATE OR ALTER PROCEDURE dbo.usp_LlamarSCPPrevisiones
    @Url NVARCHAR(500) = 'https://localhost:9000/scp/previsiones',
    @ApiKey NVARCHAR(200) = 's3Jv9!LpQ7@uZm4^TxkR8dW#1yBnV5o',
    @ResponseBody NVARCHAR(MAX) OUTPUT,
    @StatusCode INT OUTPUT,
    @ErrorMessage NVARCHAR(MAX) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @obj INT;
    DECLARE @hr INT;
    DECLARE @source VARCHAR(MAX);
    DECLARE @description VARCHAR(MAX);

    SET @ResponseBody = NULL;
    SET @StatusCode = NULL;
    SET @ErrorMessage = NULL;

    EXEC @hr = sp_OACreate 'WinHttp.WinHttpRequest.5.1', @obj OUT;
    IF @hr <> 0
    BEGIN
        EXEC sp_OAGetErrorInfo @obj, @source OUT, @description OUT;
        SET @ErrorMessage = 'Error creando WinHttpRequest: ' + ISNULL(@description, '');
        RETURN;
    END

    -- Ignora errores de certificado (certificado autofirmado en ./certi)
    EXEC @hr = sp_OASetProperty @obj, 'Option(4)', 13056;

    EXEC @hr = sp_OAMethod @obj, 'Open', NULL, 'POST', @Url, false;
    IF @hr <> 0
    BEGIN
        EXEC sp_OAGetErrorInfo @obj, @source OUT, @description OUT;
        SET @ErrorMessage = 'Open: ' + ISNULL(@description, CONVERT(VARCHAR, @hr));
        EXEC sp_OADestroy @obj;
        RETURN;
    END

    EXEC @hr = sp_OAMethod @obj, 'SetRequestHeader', NULL, 'x-api-key', @ApiKey;
    IF @hr <> 0
    BEGIN
        EXEC sp_OAGetErrorInfo @obj, @source OUT, @description OUT;
        SET @ErrorMessage = 'SetRequestHeader(x-api-key): ' + ISNULL(@description, CONVERT(VARCHAR, @hr));
        EXEC sp_OADestroy @obj;
        RETURN;
    END

    EXEC @hr = sp_OAMethod @obj, 'SetRequestHeader', NULL, 'Content-Type', 'application/json';
    IF @hr <> 0
    BEGIN
        EXEC sp_OAGetErrorInfo @obj, @source OUT, @description OUT;
        SET @ErrorMessage = 'SetRequestHeader(Content-Type): ' + ISNULL(@description, CONVERT(VARCHAR, @hr));
        EXEC sp_OADestroy @obj;
        RETURN;
    END

    EXEC @hr = sp_OAMethod @obj, 'Send', NULL, '{}';
    IF @hr <> 0
    BEGIN
        EXEC sp_OAGetErrorInfo @obj, @source OUT, @description OUT;
        SET @ErrorMessage = 'Send: ' + ISNULL(@description, CONVERT(VARCHAR, @hr));
        EXEC sp_OADestroy @obj;
        RETURN;
    END

    EXEC sp_OAGetProperty @obj, 'Status', @StatusCode OUT;
    EXEC sp_OAGetProperty @obj, 'ResponseText', @ResponseBody OUT;

    EXEC sp_OADestroy @obj;
END
GO

-- Job de sincronización: hasta 3 intentos, espera 10s entre ellos
CREATE OR ALTER PROCEDURE dbo.usp_SincronizarPrevisionesSCP
    @Url NVARCHAR(500) = 'https://localhost:9000/scp/previsiones',
    @ApiKey NVARCHAR(200) = 's3Jv9!LpQ7@uZm4^TxkR8dW#1yBnV5o',
    @MaxIntentos INT = 3
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @intento INT = 0;
    DECLARE @exito BIT = 0;
    DECLARE @responseBody NVARCHAR(MAX);
    DECLARE @statusCode INT;
    DECLARE @errorMessage NVARCHAR(MAX);
    DECLARE @ultimoError NVARCHAR(MAX);

    WHILE @intento < @MaxIntentos AND @exito = 0
    BEGIN
        SET @intento += 1;

        EXEC dbo.usp_LlamarSCPPrevisiones
            @Url = @Url,
            @ApiKey = @ApiKey,
            @ResponseBody = @responseBody OUTPUT,
            @StatusCode = @statusCode OUTPUT,
            @ErrorMessage = @errorMessage OUTPUT;

        IF @errorMessage IS NULL AND @statusCode >= 200 AND @statusCode < 300
        BEGIN
            SET @exito = 1;
            PRINT 'Intento ' + CAST(@intento AS VARCHAR) + ' OK (status ' + CAST(@statusCode AS VARCHAR) + '): ' + @responseBody;
        END
        ELSE
        BEGIN
            SET @ultimoError = ISNULL(@errorMessage, 'HTTP ' + CAST(@statusCode AS VARCHAR) + ': ' + ISNULL(@responseBody, ''));
            PRINT 'Intento ' + CAST(@intento AS VARCHAR) + ' fallido: ' + @ultimoError;

            IF @intento < @MaxIntentos
                WAITFOR DELAY '00:00:10';
        END
    END

    IF @exito = 0
    BEGIN
        RAISERROR('Fallaron los %d intentos contra /scp/previsiones. Último error: %s', 16, 1, @MaxIntentos, @ultimoError);
    END
END
GO
