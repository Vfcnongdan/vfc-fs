import fs from "fs";

const file = "/Users/admin/projects/vfc/vfc-farmer-success/src/app/farmer/diagnose/page.tsx";
let code = fs.readFileSync(file, "utf8");

// Add vfcSolutionText and solutionSets to DiagnosisResult type
code = code.replace(
  'disease?: string;\n    severity?: string;\n  };',
  'disease?: string;\n    severity?: string;\n    vfcSolutionText?: string;\n    solutionSets?: { name: string; products: string[] }[];\n  };'
);

// Replace the suggestions render block
const suggestionsStart = code.indexOf('{result.suggestions && result.suggestions.length > 0 && (');
const suggestionsEndStr = '              {/* Recommended Agencies Section';
const suggestionsEnd = code.indexOf(suggestionsEndStr);

const originalSuggestionsBlock = code.slice(suggestionsStart, suggestionsEnd);

const newSuggestionsBlock = `{( (result.suggestions && result.suggestions.length > 0) || result.rawAiResponse?.vfcSolutionText ) && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 text-base shadow-sm">
                      ✨
                    </span>
                    <h3 className="text-lg font-bold text-green-800">
                      Giải pháp VFC
                    </h3>
                  </div>

                  {result.rawAiResponse?.vfcSolutionText && (
                    <div className="mb-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                      <p className="text-sm font-bold text-blue-900 leading-relaxed">
                        {result.rawAiResponse.vfcSolutionText}
                      </p>
                    </div>
                  )}

                  {result.rawAiResponse?.solutionSets && result.rawAiResponse.solutionSets.length > 0 ? (
                    <div className="flex flex-col gap-6">
                      {result.rawAiResponse.solutionSets.map((set, idx) => {
                        const matchedSuggestions = result.suggestions?.filter(s => 
                          s.product && set.products.some((pName: string) => 
                            s.product!.name.toLowerCase().includes(pName.toLowerCase()) || 
                            pName.toLowerCase().includes(s.product!.name.toLowerCase())
                          )
                        ) || [];
                        
                        if (matchedSuggestions.length === 0) return null;
                        
                        return (
                          <div key={idx} className="bg-neutral-50/50 border border-neutral-100 rounded-2xl p-4">
                            <h4 className="font-bold text-green-700 mb-3">{set.name}</h4>
                            <div className="flex flex-col gap-4">
                              {matchedSuggestions.map((s) => {
                                const isBestMatch = s.rank === 1;
                                return (
                                  <div
                                    key={s.rank}
                                    className={\`relative flex flex-col sm:flex-row gap-4 sm:gap-6 rounded-2xl p-5 shadow-sm transition-all duration-300 overflow-hidden \${
                                      isBestMatch
                                        ? "border-2 border-green-500 bg-gradient-to-br from-green-50/60 via-white to-green-100/30 hover:shadow-lg hover:border-green-600 scale-[1.01]"
                                        : "border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md"
                                    }\`}
                                  >
                                    <div
                                      className={\`mx-auto sm:mx-0 flex-shrink-0 rounded-xl bg-white border border-neutral-100 p-2 \${
                                        isBestMatch ? "h-28 w-28" : "h-20 w-20"
                                      } flex items-center justify-center shadow-sm\`}
                                    >
                                      {s.product?.imageUrls?.[0] ? (
                                        <img
                                          src={s.product.imageUrls[0]}
                                          alt={s.product.name}
                                          className="max-h-full max-w-full object-contain"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-50 text-2xl">
                                          🧪
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-3 text-center sm:text-left">
                                      <div>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 flex-wrap justify-center sm:justify-start">
                                          <p
                                            className={\`font-black text-neutral-800 \${isBestMatch ? "text-lg sm:text-xl" : "text-base"}\`}
                                          >
                                            {s.product?.name ?? "Sản phẩm"}
                                          </p>
                                          {isBestMatch && (
                                            <span className="inline-block mx-auto sm:mx-0 rounded-full bg-green-200/60 px-2.5 py-0.5 text-[10px] font-black text-green-800 uppercase tracking-wider">
                                              Đề xuất tối ưu
                                            </span>
                                          )}
                                        </div>

                                        {s.product?.price ? (
                                          <p
                                            className={\`font-black text-sm mt-1 \${isBestMatch ? "text-green-700" : "text-neutral-500"}\`}
                                          >
                                            Giá bán:{" "}
                                            <span
                                              className={
                                                isBestMatch
                                                  ? "text-lg text-green-600"
                                                  : "text-neutral-700"
                                              }
                                            >
                                              {new Intl.NumberFormat("vi-VN", {
                                                style: "currency",
                                                currency: "VND",
                                              }).format(s.product.price)}
                                            </span>
                                          </p>
                                        ) : (
                                          <p className="text-xs text-neutral-400 mt-1">
                                            Liên hệ đại lý
                                          </p>
                                        )}
                                      </div>

                                      <div
                                        className={\`rounded-xl p-3 text-left \${isBestMatch ? "bg-green-100/40 border border-green-200/30" : "bg-neutral-50 border border-neutral-100"}\`}
                                      >
                                        <p
                                          className={\`text-sm leading-relaxed \${isBestMatch ? "font-semibold text-green-900" : "text-neutral-600"}\`}
                                        >
                                          {s.reason}
                                        </p>
                                      </div>

                                      {s.product && !loadingAgencies && agencies.length > 0 && canOrderRole && (
                                        <div className="flex justify-center sm:justify-start mt-1">
                                          <button
                                            type="button"
                                            onClick={() => handleOpenOrderModalFromProduct(s.product!)}
                                            className="flex items-center gap-2 py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition duration-200"
                                          >
                                            🛒 Đặt hàng ngay
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {isBestMatch && (
                                      <div className="absolute top-0 right-0 rounded-bl-xl bg-green-600 px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                                        Phù hợp nhất
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {result.suggestions?.map((s) => {
                        const isBestMatch = s.rank === 1;
                        return (
                          <div
                            key={s.rank}
                            className={\`relative flex flex-col sm:flex-row gap-4 sm:gap-6 rounded-2xl p-5 shadow-sm transition-all duration-300 overflow-hidden \${
                              isBestMatch
                                ? "border-2 border-green-500 bg-gradient-to-br from-green-50/60 via-white to-green-100/30 hover:shadow-lg hover:border-green-600 scale-[1.01]"
                                : "border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md"
                            }\`}
                          >
                            <div
                              className={\`mx-auto sm:mx-0 flex-shrink-0 rounded-xl bg-white border border-neutral-100 p-2 \${
                                isBestMatch ? "h-28 w-28" : "h-20 w-20"
                              } flex items-center justify-center shadow-sm\`}
                            >
                              {s.product?.imageUrls?.[0] ? (
                                <img
                                  src={s.product.imageUrls[0]}
                                  alt={s.product.name}
                                  className="max-h-full max-w-full object-contain"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-50 text-2xl">
                                  🧪
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between gap-3 text-center sm:text-left">
                              <div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 flex-wrap justify-center sm:justify-start">
                                  <p
                                    className={\`font-black text-neutral-800 \${isBestMatch ? "text-lg sm:text-xl" : "text-base"}\`}
                                  >
                                    {s.product?.name ?? "Sản phẩm"}
                                  </p>
                                  {isBestMatch && (
                                    <span className="inline-block mx-auto sm:mx-0 rounded-full bg-green-200/60 px-2.5 py-0.5 text-[10px] font-black text-green-800 uppercase tracking-wider">
                                      Đề xuất tối ưu
                                    </span>
                                  )}
                                </div>

                                {s.product?.price ? (
                                  <p
                                    className={\`font-black text-sm mt-1 \${isBestMatch ? "text-green-700" : "text-neutral-500"}\`}
                                  >
                                    Giá bán:{" "}
                                    <span
                                      className={
                                        isBestMatch
                                          ? "text-lg text-green-600"
                                          : "text-neutral-700"
                                      }
                                    >
                                      {new Intl.NumberFormat("vi-VN", {
                                        style: "currency",
                                        currency: "VND",
                                      }).format(s.product.price)}
                                    </span>
                                  </p>
                                ) : (
                                  <p className="text-xs text-neutral-400 mt-1">
                                    Liên hệ đại lý
                                  </p>
                                )}
                              </div>

                              <div
                                className={\`rounded-xl p-3 text-left \${isBestMatch ? "bg-green-100/40 border border-green-200/30" : "bg-neutral-50 border border-neutral-100"}\`}
                              >
                                <p
                                  className={\`text-sm leading-relaxed \${isBestMatch ? "font-semibold text-green-900" : "text-neutral-600"}\`}
                                >
                                  {s.reason}
                                </p>
                              </div>

                              {s.product && !loadingAgencies && agencies.length > 0 && canOrderRole && (
                                <div className="flex justify-center sm:justify-start mt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOrderModalFromProduct(s.product!)}
                                    className="flex items-center gap-2 py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition duration-200"
                                  >
                                    🛒 Đặt hàng ngay
                                  </button>
                                </div>
                              )}
                            </div>

                            {isBestMatch && (
                              <div className="absolute top-0 right-0 rounded-bl-xl bg-green-600 px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                                Phù hợp nhất
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

`;

code = code.replace(originalSuggestionsBlock, newSuggestionsBlock);

fs.writeFileSync(file, code);
